{
   'name': "Stock interface improvements",
    'version': '1.0',
    'depends': ['stock'],
    'author': "Bernard DELHEZ, AbAKUS it-solutions SARL",
    'website': "http://www.abakusitsolutions.eu",
    'category': 'Warehouse Management',
    'description': 
    """
    Stock interface improvements.
    
        it adds information to the stock move interface:
            - Partner
            - Creation Date
            - Scheduled Date
            - Source Document
            - State (picking)
            - Availability (line)
            - Status (line)
            
    This module has been developed by Bernard Delhez, intern @ AbAKUS it-solutions, under the control of Valentin Thirion.
    """,
    'data': ['view/stock.xml'],
    'qweb': ['static/src/xml/picking_improvements.xml'],
}