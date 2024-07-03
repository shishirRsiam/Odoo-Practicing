from odoo import models, fields

class SchoolStudent(models.Model):
    _name = 'odoo_tutorial.school.student'
    _description = 'School Student'

    name = fields.Char(string='Parent Name', required=True)
    student_id = fields.Many2one('odoo_tutorial.add.student', string='Student Name')
