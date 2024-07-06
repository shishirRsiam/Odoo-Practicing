# -*- coding: utf-8 -*-
{
    'name': "Cleancraft POS",

    'summary': "Cleancraft Product Module for Odoo 17",

    'description': """Advanced POS
    """,

    'author': "IT Scholar",
    'website': "https://itscholarbd.com/",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/15.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['web', 'point_of_sale', 'cleancraft_sale','cleancraft_project'],

    # always loaded
    'data': [
        'views/template_views.xml',
        'views/order_views.xml'
    ],
    'demo': [
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'cleancraft_pos/static/src/app/screens/product_screen/**/*',
            'cleancraft_pos/static/src/override/**/*',
            'cleancraft_pos/static/src/app/store/**/*',
        ],
    }
}
