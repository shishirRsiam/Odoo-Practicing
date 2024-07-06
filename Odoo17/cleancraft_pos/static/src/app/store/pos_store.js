/** @odoo-module */
import {patch} from "@web/core/utils/patch";

import {ActionpadWidget} from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import {DeliveryInfoPopup} from "@cleancraft_pos/app/store/delivery_info/delivery_info_popup";
import {PosStore} from "@point_of_sale/app/store/pos_store";
import {useService} from "@web/core/utils/hooks";
import {_t} from "@web/core/l10n/translation";
/** @odoo-module */
import {Order} from "@point_of_sale/app/store/models";

patch(Order.prototype, {
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.order_type = this.orderType
        json.delivery_date = this.deliveryDate
        json.delivery_time = this.deliveryTime
        json.delivery_note = this.deliveryNote
        return json;
    },
});
patch(ActionpadWidget.prototype, {
    setup() {
        super.setup();
        this.popup = useService("popup");
        this.orm = useService("orm");
        this.report = useService("report");
        this.notification = useService("pos_notification");
        this.hardwareProxy = useService("hardware_proxy");
        this.printer = useService("printer");
    },
    async _onDeliveryInfo() {
        await this.popup.add(DeliveryInfoPopup, {
            title: _t("Delivery Information"),
        }, {currentOrder: this.pos.get_order()});
    }
})
patch(PosStore.prototype, {
    async _processData(loadedData) {
        await super._processData(...arguments);
        this.ccPickupTimeSlots = loadedData["cc.delivery.time.slots"];
    },
})