from odoo import api, fields, models
from functools import partial
class PosInherit(models.Model):
    _inherit = 'pos.order'

    order_type = fields.Selection([('instore','In store'), ('delivery','Delivery')])
    delivery_date = fields.Date(string='Delivery Date')
    delivered_date_time = fields.Datetime()
    delivery_time = fields.Many2one('cc.delivery.time.slots',string='Time')
    delivery_note = fields.Char(string='Delivery')
    state = fields.Selection(selection_add = [
        ('instore', 'In store'),
        ('cleaning', 'Cleaning'),
        ('delivery', 'Ready')
    ])
    payment_status = fields.Selection([
        ('paid', 'Paid'),
        ('unpaid', 'Unpaid')
        ])
    
    @api.model
    def create(self, vals):
        if 'name' not in vals or vals['name'] == '/':
            vals['name'] = self.env['ir.sequence'].next_by_code('pos.order') or '/'
        
        order = super(PosInherit, self).create(vals)
        return order
  
    def write(self, vals):
        vals.setdefault('payment_status', 'paid')
        vals['state'] = 'instore'
        category_list = []
        for record in self:
            order_lines = self.env['pos.order.line'].search([('order_id', '=', record.id)])
            categories = set()
            for line in order_lines:
                product = line.product_id
                category = product.categ_id
                categories.add(category.name)
            category_list = list(categories)
        
        order = super(PosInherit, self).write(vals)
        task_id = False
        if self.name !='/':
          task_id = self.env['project.task'].create_task(task_name=self.name,sale_order_id=self.id,stage='In Store',from_pos=True)
  
        if task_id:
            for category in category_list:
               self.env['project.task'].create_task(task_name=category,sale_order_id=self.id,stage='In Store',parent_id=task_id,sub_task_stage='instore',from_pos=True)
        payment_status = 'unpaid'
        if self.state == 'paid':
            payment_status = 'paid'

        self.env.cr.execute("""UPDATE pos_order SET payment_status='%s',state='instore'
                                WHERE id = %s""" % (payment_status,self.id))
        return order

    @api.model
    def _order_fields(self, ui_order):
        process_line = partial(self.env['pos.order.line']._order_line_fields, session_id=ui_order['pos_session_id'])
        return {
            'user_id': ui_order['user_id'] or False,
            'session_id': ui_order['pos_session_id'],
            'lines': [process_line(l) for l in ui_order['lines']] if ui_order['lines'] else False,
            'pos_reference': ui_order['name'],
            'sequence_number': ui_order['sequence_number'],
            'partner_id': ui_order['partner_id'] or False,
            'date_order': ui_order['date_order'].replace('T', ' ')[:19],
            'fiscal_position_id': ui_order['fiscal_position_id'],
            'pricelist_id': ui_order.get('pricelist_id'),
            'amount_paid': ui_order['amount_paid'],
            'amount_total': ui_order['amount_total'],
            'amount_tax': ui_order['amount_tax'],
            'amount_return': ui_order['amount_return'],
            'company_id': self.env['pos.session'].browse(ui_order['pos_session_id']).company_id.id,
            'to_invoice': ui_order['to_invoice'] if "to_invoice" in ui_order else False,
            'shipping_date': ui_order['shipping_date'] if "shipping_date" in ui_order else False,
            'is_tipped': ui_order.get('is_tipped', False),
            'tip_amount': ui_order.get('tip_amount', 0),
            'access_token': ui_order.get('access_token', ''),
            'ticket_code': ui_order.get('ticket_code', ''),
            'last_order_preparation_change': ui_order.get('last_order_preparation_change', '{}'),
            'order_type': ui_order.get('order_type') if ui_order.get('order_type') else False,
            'delivery_date': ui_order.get('delivery_date') if ui_order.get('delivery_date') else False,
            'delivery_time': ui_order.get('delivery_time', False),
            'delivery_note': ui_order.get('delivery_note', False),
        }
