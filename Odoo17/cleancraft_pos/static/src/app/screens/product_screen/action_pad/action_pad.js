/** @odoo-module */
import {patch} from "@web/core/utils/patch";
import {ActionpadWidget} from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import {usePos} from "@point_of_sale/app/store/pos_hook";
import {Component, useState} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";
import {ErrorPopup} from "@point_of_sale/app/errors/popups/error_popup";
import {ConnectionLostError} from "@web/core/network/rpc_service";
import {_t} from "@web/core/l10n/translation";

patch(ActionpadWidget.prototype, {
    setup() {
        super.setup();
        this.numberBuffer = useService("number_buffer");
        this.numberBuffer.use(this._getNumberBufferConfig);
        this.numberBuffer = useService("number_buffer");
        this.numberBuffer.use(this._getNumberBufferConfig);
        this.hardwareProxy = useService("hardware_proxy");
        this.popup = useService("popup");
        this.orm = useService("orm");
        this.report = useService("report");
        this.notification = useService("pos_notification");
        this.hardwareProxy = useService("hardware_proxy");
        this.printer = useService("printer");
        this.payment_methods_from_config = this.pos.payment_methods.filter((method) =>
            this.pos.config.payment_method_ids.includes(method.id)
        );
    },
    get currentOrder() {
        return this.pos.get_order();
    },
    async validateOrder(isForceValidate) {
        if (!['delivery','instore'].includes(this.currentOrder.orderType)){
            this.popup.add(ErrorPopup, {
                title: _t("Order Type Required"),
                body: _t("Please select order type."),
            });
            return;
        }
        this.numberBuffer.capture();
        if (this.pos.config.cash_rounding) {
            if (!this.pos.get_order().check_paymentlines_rounding()) {
                this.popup.add(ErrorPopup, {
                    title: _t("Rounding error in payment lines"),
                    body: _t("The amount of your payment lines must be rounded to validate the transaction."),
                });
                return;
            }
        }
        if (this.currentOrder.is_empty()) {
            this.popup.add(ErrorPopup, {
                title: _t("Empty Order"),
                body: _t("There must be at least one product in your order before it can be validated."),
            });
            return;
        }
        if (await this._isOrderValid(isForceValidate)) {
            // remove pending payments before finalizing the validation
            if (typeof this.paymentLines !== "undefined" && this.paymentLines.length > 0) {
                for (const line of this.paymentLines) {
                    if (!line.is_done()) {
                        this.currentOrder.remove_paymentline(line);
                    }
                }
            }
            await this._finalizeValidation();
        }

    },
    async _finalizeValidation() {
        var currentOrder = this.pos.get_order();
        if (currentOrder.is_paid_with_cash() || currentOrder.get_change()) {
            this.hardwareProxy.openCashbox();
        }

        currentOrder.date_order = luxon.DateTime.now();
        // for (const line of this.paymentLines) {
        //     if (!line.amount === 0) {
        //         currentOrder.remove_paymentline(line);
        //     }
        // }
        currentOrder.finalized = true;
        currentOrder.draft = true;

        this.env.services.ui.block();
        let syncOrderResult;
        try {
            // 1. Save order to server.
            syncOrderResult = await this.pos.push_single_order(currentOrder);
            if (!syncOrderResult) {
                return;
            }
            // 2. Invoice.
            if (this.shouldDownloadInvoice() && currentOrder.is_to_invoice()) {
                if (syncOrderResult[0]?.account_move) {
                    await this.report.doAction("account.account_invoices", [syncOrderResult[0].account_move,]);
                } else {
                    throw {
                        code: 401, message: "Backend Invoice", data: {order: currentOrder},
                    };
                }
            }
        } catch (error) {
            if (error instanceof ConnectionLostError) {
                this.pos.showScreen(this.nextScreen);
                Promise.reject(error);
                return error;
            } else {
                throw error;
            }
        } finally {
            this.env.services.ui.unblock()
        }

        // 3. Post process.
        if (syncOrderResult && syncOrderResult.length > 0 && currentOrder.wait_for_push_order()) {
            await this.postPushOrderResolve(syncOrderResult.map((res) => res.id));
        }

        await this.afterOrderValidation(!!syncOrderResult && syncOrderResult.length > 0);
    },
    async _isOrderValid(isForceValidate) {
        var currentOrder = this.pos.get_order();
        if (currentOrder.get_orderlines().length === 0 && currentOrder.is_to_invoice()) {
            this.popup.add(ErrorPopup, {
                title: _t("Empty Order"),
                body: _t("There must be at least one product in your order before it can be validated and invoiced."),
            });
            return false;
        }

        // if (await this._askForCustomerIfRequired() === false) {
        //     return false;
        // }

        if ((currentOrder.is_to_invoice() || currentOrder.getShippingDate()) && !currentOrder.get_partner()) {
            const {confirmed} = await this.popup.add(ConfirmPopup, {
                title: _t("Please select the Customer"),
                body: _t("You need to select the customer before you can invoice or ship an order."),
            });
            if (confirmed) {
                this.selectPartner();
            }
            return false;
        }

        const partner = currentOrder.get_partner();
        if (currentOrder.getShippingDate() && !(partner.name && partner.street && partner.city && partner.country_id)) {
            this.popup.add(ErrorPopup, {
                title: _t("Incorrect address for shipping"), body: _t("The selected customer needs an address."),
            });
            return false;
        }
        this.currentOrder.add_paymentline(this.payment_methods_from_config[0]);

        if (currentOrder.get_total_with_tax() != 0 && currentOrder.get_paymentlines().length === 0) {
            this.notification.add(_t("Select a payment method to validate the order."));
            return false;
        }

        if (!currentOrder.is_paid() || this.invoicing) {
            return false;
        }

        if (currentOrder.has_not_valid_rounding()) {
            var line = currentOrder.has_not_valid_rounding();
            this.popup.add(ErrorPopup, {
                title: _t("Incorrect rounding"),
                body: _t("You have to round your payments lines." + line.amount + " is not rounded."),
            });
            return false;
        }

        // The exact amount must be paid if there is no cash payment method defined.
        if (Math.abs(currentOrder.get_total_with_tax() - currentOrder.get_total_paid() + currentOrder.get_rounding_applied()) > 0.00001) {
            if (!this.pos.payment_methods.some((pm) => pm.is_cash_count)) {
                this.popup.add(ErrorPopup, {
                    title: _t("Cannot return change without a cash payment method"),
                    body: _t("There is no cash payment method available in this point of sale to handle the change.\n\n Please pay the exact amount or add a cash payment method in the point of sale configuration"),
                });
                return false;
            }
        }

        // if the change is too large, it's probably an input error, make the user confirm.
        if (!isForceValidate && currentOrder.get_total_with_tax() > 0 && currentOrder.get_total_with_tax() * 1000 < currentOrder.get_total_paid()) {
            this.popup
                .add(ConfirmPopup, {
                    title: _t("Please Confirm Large Amount"),
                    body: _t("Are you sure that the customer wants to  pay") + " " + this.env.utils.formatCurrency(currentOrder.get_total_paid()) + " " + _t("for an order of") + " " + this.env.utils.formatCurrency(currentOrder.get_total_with_tax()) + " " + _t('? Clicking "Confirm" will validate the payment.'),
                })
                .then(({confirmed}) => {
                    if (confirmed) {
                        this.validateOrder(true);
                    }
                });
            return false;
        }

        if (!currentOrder._isValidEmptyOrder()) {
            return false;
        }

        return true;
    },
    async _askForCustomerIfRequired() {
        const splitPayments = this.paymentLines.filter((payment) => payment.payment_method.split_transactions);
        if (splitPayments.length && !this.currentOrder.get_partner()) {
            const paymentMethod = splitPayments[0].payment_method;
            const {confirmed} = await this.popup.add(ConfirmPopup, {
                title: _t("Customer Required"),
                body: _t("Customer is required for %s payment method.", paymentMethod.name),
            });
            if (confirmed) {
                this.selectPartner();
            }
            return false;
        }
    },
    shouldDownloadInvoice() {
        return true;
    }, get nextScreen() {
        return !this.error ? "ReceiptScreen" : "ProductScreen";
    },
    async afterOrderValidation(suggestToSync = true) {
        // Remove the order from the local storage so that when we refresh the page, the order
        // won't be there
        this.pos.db.remove_unpaid_order(this.currentOrder);

        // Ask the user to sync the remaining unsynced orders.
        if (suggestToSync && this.pos.db.get_orders().length) {
            const {confirmed} = await this.popup.add(ConfirmPopup, {
                title: _t("Remaining unsynced orders"),
                body: _t("There are unsynced orders. Do you want to sync these orders?"),
            });
            if (confirmed) {
                // NOTE: Not yet sure if this should be awaited or not.
                // If awaited, some operations like changing screen
                // might not work.
                this.pos.push_orders({draft: true});
            }
        }
        // Always show the next screen regardless of error since pos has to
        // continue working even offline.
        let nextScreen = this.nextScreen;

        if (nextScreen === "ReceiptScreen" && !this.currentOrder._printed && this.pos.config.iface_print_auto) {
            const invoiced_finalized = this.currentOrder.is_to_invoice() ? this.currentOrder.finalized : true;

            if (invoiced_finalized) {
                const printResult = await this.printer.print(OrderReceipt, {
                    data: this.pos.get_order().export_for_printing(), formatCurrency: this.env.utils.formatCurrency,
                }, {webPrintFallback: true});

                if (printResult && this.pos.config.iface_print_skip_screen) {
                    this.pos.removeOrder(this.currentOrder);
                    this.pos.add_new_order();
                    nextScreen = "ProductScreen";
                }
            }
        }

        this.pos.showScreen(nextScreen);
    }
});