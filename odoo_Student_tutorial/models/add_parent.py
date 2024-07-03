# -*- coding: utf-8 -*-
from odoo import api, fields, models
class Add_Parent(models.Model):
    _name = 'odoo_tutorial.add.parent'
    name = fields.Char(string = "Parent Name")
    phone_number = fields.Char(string = "Phone Number")
