
from odoo import api, fields, models
class AddStudent(models.Model):
    _name='odoo_tutorial.add.student'
    name = fields.Char(string = "Student Name")
    roll = fields.Char(string = "Student Roll")
    cls = fields.Char(string = "Student Class")
    parent = fields.Many2one('odoo_tutorial.add.parent', string="Parent Name")
    phone_number = fields.Char(string="Phone Number", compute="_compute_phone_number")



    @api.depends('parent')
    def _compute_phone_number(self):
        for record in self:
            record.phone_number = record.parent.phone_number
