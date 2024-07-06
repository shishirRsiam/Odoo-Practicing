/** @odoo-module */
import {_t} from "@web/core/l10n/translation";
import {AbstractAwaitablePopup} from "@point_of_sale/app/popup/abstract_awaitable_popup";
import {useState} from "@odoo/owl";
import {usePos} from "@point_of_sale/app/store/pos_hook";
import {useService} from "@web/core/utils/hooks";

export class DeliveryInfoPopup extends AbstractAwaitablePopup {
    static template = "cleancraft_pos.DeliveryInfoPopup";
    static defaultProps = {
        confirmText: _t("Ok"), cancelKey: false, body: "",
    };

    setup() {
        super.setup();
        this.notification = useService("pos_notification");
        this.popup = useService("popup");
        this.orm = useService("orm");
        this.pos = usePos();
        console.log(this.pos.ccPickupTimeSlots)
        this.currentOrder = this.pos.get_order();
    }

    async onSelectionChanged(ev) {
        const selectedSlot = ev.target.value;
        this.currentOrder.orderType = selectedSlot
        this._render();
    }

    async onSelectionDateTime(ev) {
        const orderTypeElement = document.getElementById('order_type');
        const orderType = orderTypeElement ? orderTypeElement.value : null;
        const deliveryDateElement = document.getElementById('delivery_date');
        const deliveryTimeElement = document.getElementById('delivery_time');
        if (orderType === 'delivery') {
            const buttonConfirm = document.getElementById('delivery-info-confirm');
            const deliveryDateTimeRequired = document.getElementById('z-delivery-date-time-required');
            if (typeof deliveryDateElement.value !== 'undefined' && deliveryDateElement.value !== '' && deliveryDateElement.value !== null && typeof deliveryTimeElement.value !== 'undefined' && deliveryTimeElement.value !== 'none') {
                buttonConfirm.disabled = false;
                deliveryDateTimeRequired.style.display = 'none';
            }else {
                buttonConfirm.disabled = true;
                deliveryDateTimeRequired.style.display = 'block';
            }
        }

    }

    async _render() {
        this.currentOrder = this.pos.get_order();
        this.render();
    }

    async confirm() {
        const orderTypeElement = document.getElementById('order_type');
        const deliveryDateElement = document.getElementById('delivery_date');
        const deliveryTimeElement = document.getElementById('delivery_time');
        const deliveryNoteElement = document.getElementById('delivery_note');

        const orderType = orderTypeElement ? orderTypeElement.value : null;
        const deliveryDate = deliveryDateElement ? deliveryDateElement.value : null;
        const deliveryTime = deliveryTimeElement ? deliveryTimeElement.value : null;
        const deliveryNote = deliveryNoteElement ? deliveryNoteElement.value : null;
        const currentOrder = this.pos.get_order()
        currentOrder.orderType = orderType
        if (orderType === 'delivery') {
            currentOrder.deliveryDate = deliveryDate
            currentOrder.deliveryTime = deliveryTime
            currentOrder.deliveryNote = deliveryNote
        }
        this.props.close();
    }
}
