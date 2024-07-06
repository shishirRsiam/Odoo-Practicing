from odoo import fields, models, api


class cCPosSession(models.Model):
    _inherit = 'pos.session'

    def _pos_ui_models_to_load(self):
        result = super()._pos_ui_models_to_load()
        result += ['cc.delivery.time.slots']
        return result
    def _get_pos_ui_cc_delivery_time_slots(self, params):
        return self.env["cc.delivery.time.slots"].search_read(**params["search_params"])
    def _loader_params_cc_delivery_time_slots(self):
        return {"search_params": {"domain": [], "fields": ["id","name"]}}
