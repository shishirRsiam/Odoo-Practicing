/** @odoo-module **/
import {Order} from "@point_of_sale/app/store/models";
import {patch} from "@web/core/utils/patch";
import {ErrorPopup} from "@point_of_sale/app/errors/popups/error_popup";
import {_t} from "@web/core/l10n/translation";

patch(Order.prototype, {

    _getOrderOptions() {
        const options = super._getOrderOptions(...arguments);
        if (this.draft) {
            options.draft = this.draft;
        }
        return options;
    }, export_for_printing() {
        const result = super.export_for_printing(...arguments);
        result.draft = this.draft;
        return result;
    }, async pay() {
        const currentOrder = this.pos.get_order();
        const orderType = currentOrder.orderType;
        if (!['instore', 'delivery'].includes(orderType)) {
            this.pos.env.services.popup.add(ErrorPopup, {
                title: _t("Order Type Required"), body: _t("Please select order type."),
            });
            return;
        }
        return super.pay(...arguments);
    }
});
