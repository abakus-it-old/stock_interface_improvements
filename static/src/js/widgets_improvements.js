function openerp_picking_widgets(instance){

    var module = instance.stock;
    var _t     = instance.web._t;
    var QWeb   = instance.web.qweb;

    // This widget makes sure that the scaling is disabled on mobile devices.
    // Widgets that want to display fullscreen on mobile phone need to extend this
    // widget.

    module.MobileWidget = instance.web.Widget.extend({
        start: function(){
            if(!$('#oe-mobilewidget-viewport').length){
                $('head').append('<meta id="oe-mobilewidget-viewport" name="viewport" content="initial-scale=1.0; maximum-scale=1.0; user-scalable=0;">');
            }
            return this._super();
        },
        destroy: function(){
            $('#oe-mobilewidget-viewport').remove();
            return this._super();
        },
    });

    module.PickingEditorWidget = instance.web.Widget.extend({
        //modified
        template: 'PickingEditorNewWidget',
        init: function(parent,options){
            this._super(parent,options);
            var self = this;
            this.rows = [];
            this.search_filter = "";
            jQuery.expr[":"].Contains = jQuery.expr.createPseudo(function(arg) {
                return function( elem ) {
                    return jQuery(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
                };
            });
        },
        get_header: function(){
            return this.getParent().get_header();
        },
        get_header_info: function(){
            return this.getParent().get_header_info();
        },
        get_location: function(){
            var model = this.getParent();
            var locations = [];
            var self = this;
            _.each(model.locations, function(loc){
                locations.push({name: loc.complete_name, id: loc.id,});
            });
            return locations;
        },
        get_logisticunit: function(){
            var model = this.getParent();
            var ul = [];
            var self = this;
            _.each(model.uls, function(ulog){
                ul.push({name: ulog.name, id: ulog.id,});
            });
            return ul;
        },
        get_rows: function(){
            var model = this.getParent();
            this.rows = [];
            var self = this;
            var pack_created = [];
            _.each( model.packoplines, function(packopline){
                    var pack = undefined;
                    var color = "";
                    if (packopline.product_id[1] !== undefined){ pack = packopline.package_id[1];}
                    if (packopline.product_qty == packopline.qty_done){ color = "success "; }
                    if (packopline.product_qty < packopline.qty_done){ color = "danger "; }
                    //also check that we don't have a line already existing for that package
                    if (packopline.result_package_id[1] !== undefined && $.inArray(packopline.result_package_id[0], pack_created) === -1){
                        var myPackage = $.grep(model.packages, function(e){ return e.id == packopline.result_package_id[0]; })[0];
                        self.rows.push({
                            cols: { product: packopline.result_package_id[1],
                                    qty: '',
                                    rem: '',
                                    uom: undefined,
                                    lot: undefined,
                                    pack: undefined,
                                    container: packopline.result_package_id[1],
                                    container_id: undefined,
                                    loc: packopline.location_id[1],
                                    dest: packopline.location_dest_id[1],
                                    state: '',
                                    availability: '',
                                    id: packopline.result_package_id[0],
                                    product_id: undefined,
                                    can_scan: false,
                                    head_container: true,
                                    processed: packopline.processed,
                                    package_id: myPackage.id,
                                    ul_id: myPackage.ul_id[0],
                            },
                            classes: ('success container_head ') + (packopline.processed === "true" ? 'processed hidden ':''),
                        });
                        pack_created.push(packopline.result_package_id[0]);
                    }
                    self.rows.push({
                        cols: { product: packopline.product_id[1] || packopline.package_id[1],
                                qty: packopline.product_qty,
                                rem: packopline.qty_done,
                                uom: packopline.product_uom_id[1],
                                lot: packopline.lot_id[1],
                                pack: pack,
                                container: packopline.result_package_id[1],
                                container_id: packopline.result_package_id[0],
                                loc: packopline.location_id[1],
                                dest: packopline.location_dest_id[1],
                                state: packopline.stock_move.state,
                                availability: packopline.stock_move.string_availability_info,
                                id: packopline.id,
                                product_id: packopline.product_id[0],
                                can_scan: packopline.result_package_id[1] === undefined ? true : false,
                                head_container: false,
                                processed: packopline.processed,
                                package_id: undefined,
                                ul_id: -1,
                        },
                        classes: color + (packopline.result_package_id[1] !== undefined ? 'in_container_hidden ' : '') + (packopline.processed === "true" ? 'processed hidden ':''),
                    });
            });
            //sort element by things to do, then things done, then grouped by packages
            group_by_container = _.groupBy(self.rows, function(row){
                return row.cols.container;
            });
            var sorted_row = [];
            if (group_by_container.undefined !== undefined){
                group_by_container.undefined.sort(function(a,b){return (b.classes === '') - (a.classes === '');});
                $.each(group_by_container.undefined, function(key, value){
                    sorted_row.push(value);
                });
            }

            $.each(group_by_container, function(key, value){
                if (key !== 'undefined'){
                    $.each(value, function(k,v){
                        sorted_row.push(v);
                    });
                }
            });

            return sorted_row;
        },
        renderElement: function(){
            var self = this;
            this._super();
            this.check_content_screen();
            this.$('.js_pick_done').click(function(){ self.getParent().done(); });
            this.$('.js_pick_print').click(function(){ self.getParent().print_picking(); });
            this.$('.oe_pick_app_header').text(self.get_header());
            this.$('.oe_searchbox').keyup(function(event){
                self.on_searchbox($(this).val());
            });
            this.$('.js_putinpack').click(function(){ self.getParent().pack(); });
            this.$('.js_drop_down').click(function(){ self.getParent().drop_down();});
            this.$('.js_clear_search').click(function(){
                self.on_searchbox('');
                self.$('.oe_searchbox').val('');
            });
            this.$('.oe_searchbox').focus(function(){
                self.getParent().barcode_scanner.disconnect();
            });
            this.$('.oe_searchbox').blur(function(){
                self.getParent().barcode_scanner.connect(function(ean){
                    self.get_Parent().scan(ean);
                });
            })
            this.$('#js_select').change(function(){
                var selection = self.$('#js_select option:selected').attr('value');
                if (selection === "ToDo"){
                    self.getParent().$('.js_pick_pack').removeClass('hidden')
                    self.getParent().$('.js_drop_down').removeClass('hidden')
                    self.$('.js_pack_op_line.processed').addClass('hidden')
                    self.$('.js_pack_op_line:not(.processed)').removeClass('hidden')
                }
                else{
                    self.getParent().$('.js_pick_pack').addClass('hidden')
                    self.getParent().$('.js_drop_down').addClass('hidden')
                    self.$('.js_pack_op_line.processed').removeClass('hidden')
                    self.$('.js_pack_op_line:not(.processed)').addClass('hidden')
                }
                self.on_searchbox(self.search_filter);
            });
            this.$('.js_plus').click(function(){
                var id = $(this).data('product-id');
                var op_id = $(this).parents("[data-id]:first").data('id');
                self.getParent().scan_product_id(id,true,op_id);
            });
            this.$('.js_minus').click(function(){
                var id = $(this).data('product-id');
                var op_id = $(this).parents("[data-id]:first").data('id');
                self.getParent().scan_product_id(id,false,op_id);
            });
            this.$('.js_unfold').click(function(){
                var op_id = $(this).parent().data('id');
                var line = $(this).parent();
                //select all js_pack_op_line with class in_container_hidden and correct container-id
                select = self.$('.js_pack_op_line.in_container_hidden[data-container-id='+op_id+']')
                if (select.length > 0){
                    //we unfold
                    line.addClass('warning');
                    select.removeClass('in_container_hidden');
                    select.addClass('in_container');
                }
                else{
                    //we fold
                    line.removeClass('warning');
                    select = self.$('.js_pack_op_line.in_container[data-container-id='+op_id+']')
                    select.removeClass('in_container');
                    select.addClass('in_container_hidden');
                }
            });
            this.$('.js_create_lot').click(function(){
                var op_id = $(this).parents("[data-id]:first").data('id');
                var lot_name = false;
                self.$('.js_lot_scan').val('');
                var $lot_modal = self.$el.siblings('#js_LotChooseModal');
                //disconnect scanner to prevent scanning a product in the back while dialog is open
                self.getParent().barcode_scanner.disconnect();
                $lot_modal.modal()
                //focus input
                $lot_modal.on('shown.bs.modal', function(){
                    self.$('.js_lot_scan').focus();
                })
                //reactivate scanner when dialog close
                $lot_modal.on('hidden.bs.modal', function(){
                    self.getParent().barcode_scanner.connect(function(ean){
                        self.getParent().scan(ean);
                    });
                })
                self.$('.js_lot_scan').focus();
                //button action
                self.$('.js_validate_lot').click(function(){
                    //get content of input
                    var name = self.$('.js_lot_scan').val();
                    if (name.length !== 0){
                        lot_name = name;
                    }
                    $lot_modal.modal('hide');
                    //we need this here since it is not sure the hide event
                    //will be catch because we refresh the view after the create_lot call
                    self.getParent().barcode_scanner.connect(function(ean){
                        self.getParent().scan(ean);
                    });
                    self.getParent().create_lot(op_id, lot_name);
                });
            });
            this.$('.js_delete_pack').click(function(){
                var pack_id = $(this).parents("[data-id]:first").data('id');
                self.getParent().delete_package_op(pack_id);
            });
            this.$('.js_print_pack').click(function(){
                var pack_id = $(this).parents("[data-id]:first").data('id');
                // $(this).parents("[data-id]:first").data('id')
                self.getParent().print_package(pack_id);
            });
            this.$('.js_submit_value').submit(function(event){
                var op_id = $(this).parents("[data-id]:first").data('id');
                var value = parseFloat($("input", this).val());
                if (value>=0){
                    self.getParent().set_operation_quantity(value, op_id);
                }
                $("input", this).val("");
                return false;
            });
            this.$('.js_qty').focus(function(){
                self.getParent().barcode_scanner.disconnect();
            });
            this.$('.js_qty').blur(function(){
                var op_id = $(this).parents("[data-id]:first").data('id');
                var value = parseFloat($(this).val());
                if (value>=0){
                    self.getParent().set_operation_quantity(value, op_id);
                }
                
                self.getParent().barcode_scanner.connect(function(ean){
                    self.getParent().scan(ean);
                });
            });
            this.$('.js_change_src').click(function(){
                var op_id = $(this).parents("[data-id]:first").data('id');//data('op_id');
                self.$('#js_loc_select').addClass('source');
                self.$('#js_loc_select').data('op-id',op_id);
                self.$el.siblings('#js_LocationChooseModal').modal();
            });
            this.$('.js_change_dst').click(function(){
                var op_id = $(this).parents("[data-id]:first").data('id');
                self.$('#js_loc_select').data('op-id',op_id);
                self.$el.siblings('#js_LocationChooseModal').modal();
            });
            this.$('.js_pack_change_dst').click(function(){
                var op_id = $(this).parents("[data-id]:first").data('id');
                self.$('#js_loc_select').addClass('pack');
                self.$('#js_loc_select').data('op-id',op_id);
                self.$el.siblings('#js_LocationChooseModal').modal();
            });
            this.$('.js_validate_location').click(function(){
                //get current selection
                var select_dom_element = self.$('#js_loc_select');
                var loc_id = self.$('#js_loc_select option:selected').data('loc-id');
                var src_dst = false;
                var op_id = select_dom_element.data('op-id');
                if (select_dom_element.hasClass('pack')){
                    select_dom_element.removeClass('source');
                    op_ids = [];
                    self.$('.js_pack_op_line[data-container-id='+op_id+']').each(function(){
                        op_ids.push($(this).data('id'));
                    });
                    op_id = op_ids;
                }
                else if (select_dom_element.hasClass('source')){
                    src_dst = true;
                    select_dom_element.removeClass('source');
                }
                if (loc_id === false){
                    //close window
                    self.$el.siblings('#js_LocationChooseModal').modal('hide');
                }
                else{
                    self.$el.siblings('#js_LocationChooseModal').modal('hide');
                    self.getParent().change_location(op_id, parseInt(loc_id), src_dst);

                }
            });
            this.$('.js_pack_configure').click(function(){
                var pack_id = $(this).parents(".js_pack_op_line:first").data('package-id');
                var ul_id = $(this).parents(".js_pack_op_line:first").data('ulid');
                self.$('#js_packconf_select').val(ul_id);
                self.$('#js_packconf_select').data('pack-id',pack_id);
                self.$el.siblings('#js_PackConfModal').modal();
            });
            this.$('.js_validate_pack').click(function(){
                //get current selection
                var select_dom_element = self.$('#js_packconf_select');
                var ul_id = self.$('#js_packconf_select option:selected').data('ul-id');
                var pack_id = select_dom_element.data('pack-id');
                self.$el.siblings('#js_PackConfModal').modal('hide');
                if (pack_id){
                    self.getParent().set_package_pack(pack_id, ul_id);
                    $('.container_head[data-package-id="'+pack_id+'"]').data('ulid', ul_id);
                }
            });
            
            //remove navigtion bar from default openerp GUI
            $('td.navbar').html('<div></div>');
        },
        on_searchbox: function(query){
            //hide line that has no location matching the query and highlight location that match the query
            this.search_filter = query;
            var processed = ".processed";
            if (this.$('#js_select option:selected').attr('value') == "ToDo"){
                processed = ":not(.processed)";
            }
            if (query !== '') {
                this.$('.js_loc:not(.js_loc:Contains('+query+'))').removeClass('info');
                this.$('.js_loc:Contains('+query+')').addClass('info');
                this.$('.js_pack_op_line'+processed+':not(.js_pack_op_line:has(.js_loc:Contains('+query+')))').addClass('hidden');
                this.$('.js_pack_op_line'+processed+':has(.js_loc:Contains('+query+'))').removeClass('hidden');
            }
            //if no query specified, then show everything
            if (query === '') {
                this.$('.js_loc').removeClass('info');
                this.$('.js_pack_op_line'+processed+'.hidden').removeClass('hidden');
            }
            this.check_content_screen();
        },
        check_content_screen: function(){
            //get all visible element and if none has positive qty, disable put in pack and process button
            var self = this;
            var processed = this.$('.js_pack_op_line.processed');
            var qties = this.$('.js_pack_op_line:not(.processed):not(.hidden) .js_qty').map(function(){return $(this).val()});
            var container = this.$('.js_pack_op_line.container_head:not(.processed):not(.hidden)')
            var disabled = true;
            $.each(qties,function(index, value){
                if (parseInt(value)>0){
                    disabled = false;
                }
            });

            if (disabled){
                if (container.length===0){
                    self.$('.js_drop_down').addClass('disabled');
                }
                else {
                    self.$('.js_drop_down').removeClass('disabled');
                }
                self.$('.js_pick_pack').addClass('disabled');
                if (processed.length === 0){
                    self.$('.js_pick_done').addClass('disabled');
                }
                else {
                    self.$('.js_pick_done').removeClass('disabled');
                }
            }
            else{
                self.$('.js_drop_down').removeClass('disabled');
                self.$('.js_pick_pack').removeClass('disabled');
                self.$('.js_pick_done').removeClass('disabled');
            }
        },
        get_current_op_selection: function(ignore_container){
            //get ids of visible on the screen
            pack_op_ids = []
            this.$('.js_pack_op_line:not(.processed):not(.js_pack_op_line.hidden):not(.container_head)').each(function(){
                cur_id = $(this).data('id');
                pack_op_ids.push(parseInt(cur_id));
            });
            //get list of element in this.rows where rem > 0 and container is empty is specified
            list = []
            _.each(this.rows, function(row){
                if (row.cols.rem > 0 && (ignore_container || row.cols.container === undefined)){
                    list.push(row.cols.id);
                }
            });
            //return only those visible with rem qty > 0 and container empty
            return _.intersection(pack_op_ids, list);
        },
        remove_blink: function(){
            this.$('.js_pack_op_line.blink_me').removeClass('blink_me');
        },
        blink: function(op_id){
            this.$('.js_pack_op_line[data-id="'+op_id+'"]').addClass('blink_me');
        },
        check_done: function(){
            var model = this.getParent();
            var self = this;
            var done = true;
            _.each( model.packoplines, function(packopline){
                if (packopline.processed === "false"){
                    done = false;
                    return done;
                }
            });
            return done;
        },
        get_visible_ids: function(){
            var self = this;
            var visible_op_ids = []
            var op_ids = this.$('.js_pack_op_line:not(.processed):not(.hidden):not(.container_head):not(.in_container):not(.in_container_hidden)').map(function(){
                return $(this).data('id');
            });
            $.each(op_ids, function(key, op_id){
                visible_op_ids.push(parseInt(op_id));
            });
            return visible_op_ids;
        },
    });

    
    
    
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

    
    
    
    module.PickingMenuWidget = module.MobileWidget.extend({
        template: 'PickingMenuNewWidget',
        init: function(parent, params){
            this._super(parent,params);
            var self = this;
            $(window).bind('hashchange', function(){
                var states = $.bbq.getState();
                if (states.action === "stock.ui"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.ui',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.products"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.products',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.menu"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.menu',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
            });
            this.picking_types = [];
            this.loaded = this.load();
            this.scanning_type = 0;
            this.barcode_scanner = new module.BarcodeScanner();
            this.pickings_by_type = {};
            this.pickings_by_id = {};
            this.picking_search_string = "";
        },
        load: function(){
            var self = this;
            return new instance.web.Model('stock.picking.type').get_func('search_read')([],[])
                .then(function(types){
                    self.picking_types = types;
                    type_ids = [];
                    for(var i = 0; i < types.length; i++){
                        self.pickings_by_type[types[i].id] = [];
                        type_ids.push(types[i].id);
                    }
                    self.pickings_by_type[0] = [];

                    return new instance.web.Model('stock.picking').call('search_read',[ [['state','in', ['assigned', 'partially_available']], ['picking_type_id', 'in', type_ids]], [] ], {context: new instance.web.CompoundContext()});

                }).then(function(pickings){
                    self.pickings = pickings;
                    for(var i = 0; i < pickings.length; i++){
                        var picking = pickings[i];
                        self.pickings_by_type[picking.picking_type_id[0]].push(picking);
                        self.pickings_by_id[picking.id] = picking;
                        self.picking_search_string += '' + picking.id + ':' + (picking.name ? picking.name.toUpperCase(): '') + '\n';
                    }

                });
        },
        renderElement: function(){
            this._super();
            var self = this;
            this.$('.js_pick_quit').click(function(){ self.quit(); });
            this.$('.js_pick_scan').click(function(){ self.scan_picking($(this).data('id')); });
            this.$('.js_pick_last').click(function(){ self.goto_last_picking_of_type($(this).data('id')); });
            self.$('.js_pick_menu').click(function(){ self.menu(); });
            self.$('.js_pick_products').click(function(){ self.goto_products(); });
            this.$('.oe_searchbox').keyup(function(event){
                self.on_searchbox($(this).val());
            });
            //remove navigtion bar from default openerp GUI
            $('td.navbar').html('<div></div>');
        },
        start: function(){
            this._super();
            var self = this;
            instance.webclient.set_content_full_screen(true);
            this.barcode_scanner.connect(function(barcode){
                self.on_scan(barcode);
            });
            this.loaded.then(function(){
                self.renderElement();
            });
        },
        menu: function(){
            $.bbq.pushState('#action=stock.menu');
            $(window).trigger('hashchange');
        },
        goto_products: function(){
            $.bbq.pushState('#action=stock.products');
            $(window).trigger('hashchange');
        },
        goto_picking: function(picking_id){
            $.bbq.pushState('#action=stock.ui&picking_id='+picking_id);
            $(window).trigger('hashchange');
        },
        goto_last_picking_of_type: function(type_id){
            $.bbq.pushState('#action=stock.ui&picking_type_id='+type_id);
            $(window).trigger('hashchange');
        },
        search_picking: function(barcode){
            try {
                var re = RegExp("([0-9]+):.*?"+barcode.toUpperCase(),"gi");
            }
            catch(e) {
                //avoid crash if a not supported char is given (like '\' or ')')
	        return [];
            }

            var results = [];
            for(var i = 0; i < 100; i++){
                r = re.exec(this.picking_search_string);
                if(r){
                    var picking = this.pickings_by_id[Number(r[1])];
                    if(picking){
                        results.push(picking);
                    }
                }else{
                    break;
                }
            }
            return results;
        },
        on_scan: function(barcode){
            var self = this;
            for(var i = 0, len = this.pickings.length; i < len; i++){
                var picking = this.pickings[i];
                if(picking.name.toUpperCase() === $.trim(barcode.toUpperCase())){
                    this.goto_picking(picking.id);
                    break;
                }
            }
            this.$('.js_picking_not_found').removeClass('hidden');

            clearTimeout(this.picking_not_found_timeout);
            this.picking_not_found_timeout = setTimeout(function(){
                self.$('.js_picking_not_found').addClass('hidden');
            },2000);

        },
        on_searchbox: function(query){
            var self = this;

            clearTimeout(this.searchbox_timeout);
            this.searchbox_timout = setTimeout(function(){
                if(query){
                    self.$('.js_picking_not_found').addClass('hidden');
                    self.$('.js_picking_categories').addClass('hidden');
                    self.$('.js_picking_search_results').html(
                        QWeb.render('PickingSearchNewResults',{results:self.search_picking(query)})
                    );
                    self.$('.js_picking_search_results .oe_picking').click(function(){
                        self.goto_picking($(this).data('id'));
                    });
                    self.$('.js_picking_search_results').removeClass('hidden');
                }else{
                    self.$('.js_title_label').removeClass('hidden');
                    self.$('.js_picking_categories').removeClass('hidden');
                    self.$('.js_picking_search_results').addClass('hidden');
                }
            },100);
        },
        quit: function(){
            return new instance.web.Model("ir.model.data").get_func("search_read")([['name', '=', 'action_picking_type_form']], ['res_id']).pipe(function(res) {
                    window.location = '/web#action=' + res[0]['res_id'];
                });
        },
        destroy: function(){
            this._super();
            this.barcode_scanner.disconnect();
            instance.webclient.set_content_full_screen(false);
        },
    });
    openerp.web.client_actions.add('stock.menu', 'instance.stock.PickingMenuWidget');

    
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

    
    module.PickingProductsWidget = module.MobileWidget.extend({
        template: 'PageWidget',
        init: function(parent, params){
            this._super(parent,params);
            var self = this;
            $(window).bind('hashchange', function(){
                var states = $.bbq.getState();
                if (states.action === "stock.product"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.product',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.products"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.products',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.menu"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.menu',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
            });
            this.products = [];
            this.product_templates = {};
            this.loaded = this.load();
            this.products_by_id = {};
            this.product_search_string = "";
        },
        load: function(){
            var self = this;
            return new instance.web.Model("product.template")
                .query(['id','product_brand_id'])
                .filter([['type', '=', 'product']])
                .all()
                .then(function(product_tmpls) {
                    for(var i = 0; i < product_tmpls.length; i++){
                        var product_template = product_tmpls[i];
                        self.product_templates[product_template.id] = product_template.product_brand_id[1];
                    }
                    return new instance.web.Model("product.product")
                        .query(['id','name','ean13','default_code','product_tmpl_id'])
                        .filter([['active', '=', true]])
                        .order_by('name')
                        .all()
                }).then(function(prods) {
                    for(var i = 0; i < prods.length; i++){
                        var product = prods[i];
                        if (!self.product_templates[product.product_tmpl_id[0]]){continue;}
                        product.ean13 = product.ean13 ? product.ean13 : ""
                        product.brand = product.product_tmpl_id[0] ? self.product_templates[product.product_tmpl_id[0]] : "";
                        self.products_by_id[product.id] = product;
                        self.product_search_string += '' + product.id + ':' + (product.ean13 ? product.ean13.toUpperCase(): '') 
                                                                            + (product.name ? product.name.toUpperCase(): '') 
                                                                            + (product.brand ? product.brand.toUpperCase(): '') 
                                                                            + (product.default_code ? product.default_code.toUpperCase(): '') 
                                                                            + '\n';
                        self.products.push(product)
                    }
                    self.products.sort(function(a, b) {return a.brand.localeCompare(b.brand);})
                });
        },
        start_rendering: function(){
            var self = this;
            this.$('.oe_searchbox').keyup(function(event){
                self.on_searchbox($(this).val());
            });
            this.$('#product_search_box').focus();
            this.$('.js_pick_quit').click(function(){ self.quit(); });
            self.$('.js_clear_search').click(function(){ self.$('#product_search_box').val(""); self.on_searchbox(""); self.$('#product_search_box').focus();});
            self.$('.js_pick_menu').click(function(){ self.menu(); });
            self.$('.js_pick_products').click(function(){ self.goto_products(); });
            self.$('.content').html(QWeb.render('PickingProductsWidget',{products:self.products}));
            self.$('.js_products_table_todo .oe_product').click(function(){
                self.goto_product($(this).data('id'));
            });
        },
        start: function(){
            var self = this;
            instance.webclient.set_content_full_screen(true);            
            this.loaded.then(function(){
               self.start_rendering();
            });
        },
        menu: function(){
            $.bbq.pushState('#action=stock.menu');
            $(window).trigger('hashchange');
        },
        goto_products: function(){
            $.bbq.pushState('#action=stock.products');
            $(window).trigger('hashchange');
        },
        goto_product: function(product_id){
            $.bbq.pushState('#action=stock.product&product_id='+product_id);
            $(window).trigger('hashchange');
        },
        search_products: function(barcode){
            if ((_.isString(barcode) && barcode.length == 0) || (!barcode)){
                return this.products;
            }
            try {
                var re = RegExp("([0-9]+):.*?"+barcode.toUpperCase(),"gi");
            }
            catch(e) {
                //avoid crash if a not supported char is given (like '\' or ')')
	        return [];
            }

            var results = [];
            for(var i = 0; i < 100; i++){
                r = re.exec(this.product_search_string);
                if(r){
                    var product = this.products_by_id[Number(r[1])];
                    if(product){
                        results.push(product);
                    }
                }else{
                    break;
                }
            }
            return results;
        },
        on_searchbox: function(query){
            var self = this;

            clearTimeout(this.searchbox_timeout);
            this.searchbox_timout = setTimeout(function(){
                self.$('.content').html(
                        QWeb.render('PickingProductsWidget',{products:self.search_products(query)})
                    );
                self.$('.js_products_table_todo .oe_product').click(function(){
                    self.goto_product($(this).data('id'));
                });
                if(query){
                    self.$('.js_picking_not_found').addClass('hidden');
                    self.$('.js_picking_categories').addClass('hidden');
                }else{
                    self.$('.js_title_label').removeClass('hidden');
                    self.$('.js_picking_categories').removeClass('hidden');
                }
            },100);
        },
        quit: function(){
            return new instance.web.Model("ir.model.data").get_func("search_read")([['name', '=', 'action_picking_type_form']], ['res_id']).pipe(function(res) {
                    window.location = '/web#action=' + res[0]['res_id'];
                });
        },
        destroy: function(){
            this._super();
            instance.webclient.set_content_full_screen(false);
        },
    });
    openerp.web.client_actions.add('stock.products', 'instance.stock.PickingProductsWidget');
    
    
    
    
    
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

    
    
    
    
    module.PickingMainWidget = module.MobileWidget.extend({
        template: 'PickingMainNewWidget',
        init: function(parent,params){
            this._super(parent,params);
            var self = this;
            $(window).bind('hashchange', function(){
                var states = $.bbq.getState();
                if (states.action === "stock.menu"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.menu',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.products"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.products',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
            });
            init_hash = $.bbq.getState();
            this.picking_type_id = init_hash.picking_type_id ? init_hash.picking_type_id:0;
            this.picking_id = init_hash.picking_id ? init_hash.picking_id:undefined;
            this.picking = null;
            this.pickings = [];
            this.packoplines = null;
            this.stockmoves = null;
            this.selected_operation = { id: null, picking_id: null};
            this.packages = null;
            this.barcode_scanner = new module.BarcodeScanner();
            this.locations = [];
            this.uls = [];
            if(this.picking_id){
                this.loaded =  this.load(this.picking_id);
            }else{
                this.loaded =  this.load();
            }

        },

        // load the picking data from the server. If picking_id is undefined, it will take the first picking
        // belonging to the category
        load: function(picking_id){
            var self = this;


            function load_picking_list(type_id){
                var pickings = new $.Deferred();
                new instance.web.Model('stock.picking')
                    .call('get_next_picking_for_ui',[{'default_picking_type_id':parseInt(type_id)}])
                    .then(function(picking_ids){
                        if(!picking_ids || picking_ids.length === 0){
                            (new instance.web.Dialog(self,{
                                title: _t('No Picking Available'),
                                buttons: [{
                                    text:_t('Ok'),
                                    click: function(){
                                        self.menu();
                                    }
                                }]
                            }, _t('<p>We could not find a picking to display.</p>'))).open();

                            pickings.reject();
                        }else{
                            self.pickings = picking_ids;
                            pickings.resolve(picking_ids);
                        }
                    });

                return pickings;
            }

            // if we have a specified picking id, we load that one, and we load the picking of the same type as the active list
            if( picking_id ){
                var loaded_picking = new instance.web.Model('stock.picking')
                    .call('read',[[parseInt(picking_id)], [], new instance.web.CompoundContext()])
                    .then(function(picking){
                        self.picking = picking[0];
                        self.picking_type_id = picking[0].picking_type_id[0];
                        return load_picking_list(self.picking.picking_type_id[0]);
                    });
            }else{
                // if we don't have a specified picking id, we load the pickings belong to the specified type, and then we take
                // the first one of that list as the active picking
                var loaded_picking = new $.Deferred();
                load_picking_list(self.picking_type_id)
                    .then(function(){
                        return new instance.web.Model('stock.picking').call('read',[self.pickings[0],[], new instance.web.CompoundContext()]);
                    })
                    .then(function(picking){
                        self.picking = picking;
                        self.picking_type_id = picking.picking_type_id[0];
                        loaded_picking.resolve();
                    });
            }

            return loaded_picking.then(function(){
                    return new instance.web.Model('stock.location').call('search',[[['usage','=','internal']]]).then(function(locations_ids){
                        return new instance.web.Model('stock.location').call('read',[locations_ids, []]).then(function(locations){
                            self.locations = locations;
                        });
                    });
                }).then(function(){
                    return new instance.web.Model('stock.picking').call('check_group_pack').then(function(result){
                        return self.show_pack = result;
                    });
                }).then(function(){
                    return new instance.web.Model('stock.picking').call('check_group_lot').then(function(result){
                        return self.show_lot = result;
                    });
                }).then(function(){
                    if (self.picking.pack_operation_exist === false){
                        self.picking.recompute_pack_op = false;
                        return new instance.web.Model('stock.picking').call('do_prepare_partial',[[self.picking.id]]);
                    }
                }).then(function(){
                        return new instance.web.Model('stock.pack.operation').call('search',[[['picking_id','=',self.picking.id]]])
                }).then(function(pack_op_ids){
                        return new instance.web.Model('stock.pack.operation').call('read',[pack_op_ids, [], new instance.web.CompoundContext()])
                }).then(function(operations){
                    self.packoplines = operations;
                    var package_ids = [];

                    for(var i = 0; i < operations.length; i++){
                        if(!_.contains(package_ids,operations[i].result_package_id[0])){
                            if (operations[i].result_package_id[0]){
                                package_ids.push(operations[i].result_package_id[0]);
                            }
                        }
                    }
                    return new instance.web.Model('stock.quant.package').call('read',[package_ids, [], new instance.web.CompoundContext()])
                }).then(function(packages){
                    self.packages = packages;
                }).then(function(){
                        return new instance.web.Model('product.ul').call('search',[[]])
                }).then(function(uls_ids){
                        return new instance.web.Model('product.ul').call('read',[uls_ids, []])
                }).then(function(uls){
                    self.uls = uls;
                }).then(function(){
                        return new instance.web.Model('stock.move').call('search',[[['picking_id','=',self.picking.id]]])
                }).then(function(stock_move_ids){
                        return new instance.web.Model('stock.move').call('read',[stock_move_ids, [], new instance.web.CompoundContext()])
                }).then(function(moves){
                    self.stockmoves = moves;
                    var states = {draft:"New", cancel:"Cancelled", waiting:"Waiting Another Move", confirmed:"Waiting Availability", assigned:"Available", done:"Done"};
                    for(var i = 0; i < self.packoplines.length; i++){
                        for(var j = 0; j < moves.length; j++){
                            if(self.packoplines[i].picking_id[0] == moves[j].picking_id[0] && self.packoplines[i].product_id[0] == moves[j].product_id[0]){
                                if(states.hasOwnProperty(moves[j].state)){
                                    moves[j].state = states[moves[j].state]
                                }
                                self.packoplines[i].stock_move = moves[j];
                                break;
                            }
                        }
                    }
            });
        },
        start: function(){
            this._super();
            var self = this;
            instance.webclient.set_content_full_screen(true);
            this.barcode_scanner.connect(function(ean){
                self.scan(ean);
            });

            this.$('.js_pick_quit').click(function(){ self.quit(); });
            this.$('.js_pick_prev').click(function(){ self.picking_prev(); });
            this.$('.js_pick_next').click(function(){ self.picking_next(); });
            this.$('.js_pick_menu').click(function(){ self.menu(); });
            this.$('.js_pick_products').click(function(){ self.goto_products(); });
            this.$('.js_reload_op').click(function(){ self.reload_pack_operation();});

            $.when(this.loaded).done(function(){
                self.picking_editor = new module.PickingEditorWidget(self);
                self.picking_editor.replace(self.$('.oe_placeholder_picking_editor'));

                if( self.picking.id === self.pickings[0]){
                    self.$('.js_pick_prev').addClass('disabled');
                }else{
                    self.$('.js_pick_prev').removeClass('disabled');
                }

                if( self.picking.id === self.pickings[self.pickings.length-1] ){
                    self.$('.js_pick_next').addClass('disabled');
                }else{
                    self.$('.js_pick_next').removeClass('disabled');
                }
                if (self.picking.recompute_pack_op){
                    self.$('.oe_reload_op').removeClass('hidden');
                }
                else {
                    self.$('.oe_reload_op').addClass('hidden');
                }
                if (!self.show_pack){
                    self.$('.js_pick_pack').addClass('hidden');
                }
                if (!self.show_lot){
                    self.$('.js_create_lot').addClass('hidden');
                }

            }).fail(function(error) {console.log(error);});

        },
        on_searchbox: function(query){
            var self = this;
            self.picking_editor.on_searchbox(query.toUpperCase());
        },
        // reloads the data from the provided picking and refresh the ui.
        // (if no picking_id is provided, gets the first picking in the db)
        refresh_ui: function(picking_id){
            var self = this;
            var remove_search_filter = "";
            if (self.picking.id === picking_id){
                remove_search_filter = self.$('.oe_searchbox').val();
            }
            return this.load(picking_id)
                .then(function(){
                    self.picking_editor.remove_blink();
                    self.picking_editor.renderElement();
                    if (!self.show_pack){
                        self.$('.js_pick_pack').addClass('hidden');
                    }
                    if (!self.show_lot){
                        self.$('.js_create_lot').addClass('hidden');
                    }
                    if (self.picking.recompute_pack_op){
                        self.$('.oe_reload_op').removeClass('hidden');
                    }
                    else {
                        self.$('.oe_reload_op').addClass('hidden');
                    }

                    if( self.picking.id === self.pickings[0]){
                        self.$('.js_pick_prev').addClass('disabled');
                    }else{
                        self.$('.js_pick_prev').removeClass('disabled');
                    }

                    if( self.picking.id === self.pickings[self.pickings.length-1] ){
                        self.$('.js_pick_next').addClass('disabled');
                    }else{
                        self.$('.js_pick_next').removeClass('disabled');
                    }
                    if (remove_search_filter === ""){
                        self.$('.oe_searchbox').val('');
                        self.on_searchbox('');
                    }
                    else{
                        self.$('.oe_searchbox').val(remove_search_filter);
                        self.on_searchbox(remove_search_filter);
                    }
                });
        },
        get_header: function(){
            if(this.picking){
                return this.picking.name;  
            }else{
                return '';
            }
        },
        get_header_info: function(){
            if(this.picking){
                var state = this.picking.state
                var states = {  draft:"Draft", 
                                cancel:"Cancelled", 
                                waiting:"Waiting Another Operation",
                                partially_available: "Partially Available",
                                confirmed:"Waiting Availability", 
                                assigned:"Ready to Transfer", 
                                done:"Transferred"
                             };
                             
                if(states.hasOwnProperty(state)){
                    state = states[state]
                }
                
                var values = [];
                values.push({key:"Partner", value:this.picking.partner_id[1]})
                values.push({key:"Creation Date", value:this.picking.date})
                values.push({key:"Scheduled Date", value:this.picking.min_date})
                values.push({key:"Source Document", value:this.picking.origin})
                values.push({key:"State", value:state})
             
                return values;
            }else{
                return [];
            }
        },
        menu: function(){
            $.bbq.pushState('#action=stock.menu');
            $(window).trigger('hashchange');
        },
        goto_products: function(){
            $.bbq.pushState('#action=stock.products');
            $(window).trigger('hashchange');
        },
        scan: function(ean){ //scans a barcode, sends it to the server, then reload the ui
            var self = this;
            var product_visible_ids = this.picking_editor.get_visible_ids();
            return new instance.web.Model('stock.picking')
                .call('process_barcode_from_ui', [self.picking.id, ean, product_visible_ids])
                .then(function(result){
                    if (result.filter_loc !== false){
                        //check if we have receive a location as answer
                        if (result.filter_loc !== undefined){
                            var modal_loc_hidden = self.$('#js_LocationChooseModal').attr('aria-hidden');
                            if (modal_loc_hidden === "false"){
                                var line = self.$('#js_LocationChooseModal .js_loc_option[data-loc-id='+result.filter_loc_id+']').attr('selected','selected');
                            }
                            else{
                                self.$('.oe_searchbox').val(result.filter_loc);
                                self.on_searchbox(result.filter_loc);
                            }
                        }
                    }
                    if (result.operation_id !== false){
                        self.refresh_ui(self.picking.id).then(function(){
                            return self.picking_editor.blink(result.operation_id);
                        });
                    }
                });
        },
        scan_product_id: function(product_id,increment,op_id){ //performs the same operation as a scan, but with product id instead
            var self = this;
            return new instance.web.Model('stock.picking')
                .call('process_product_id_from_ui', [self.picking.id, product_id, op_id, increment])
                .then(function(result){
                    return self.refresh_ui(self.picking.id);
                });
        },
        pack: function(){
            var self = this;
            var pack_op_ids = self.picking_editor.get_current_op_selection(false);
            if (pack_op_ids.length !== 0){
                return new instance.web.Model('stock.picking')
                    .call('action_pack',[[[self.picking.id]], pack_op_ids])
                    .then(function(pack){
                        //TODO: the functionality using current_package_id in context is not needed anymore
                        instance.session.user_context.current_package_id = false;
                        return self.refresh_ui(self.picking.id);
                    });
            }
        },
        drop_down: function(){
            var self = this;
            var pack_op_ids = self.picking_editor.get_current_op_selection(true);
            if (pack_op_ids.length !== 0){
                return new instance.web.Model('stock.pack.operation')
                    .call('action_drop_down', [pack_op_ids])
                    .then(function(){
                            return self.refresh_ui(self.picking.id).then(function(){
                                if (self.picking_editor.check_done()){
                                    return self.done();
                                }
                            });
                    });
            }
        },
        done: function(){
            var self = this;
            return new instance.web.Model('stock.picking')
                .call('action_done_from_ui',[self.picking.id, {'default_picking_type_id': self.picking_type_id}])
                .then(function(new_picking_ids){
                    if (new_picking_ids){
                        return self.refresh_ui(new_picking_ids[0]);
                    }
                    else {
                        return 0;
                    }
                });
        },
        create_lot: function(op_id, lot_name){
            var self = this;
            return new instance.web.Model('stock.pack.operation')
                .call('create_and_assign_lot',[parseInt(op_id), lot_name])
                .then(function(){
                    return self.refresh_ui(self.picking.id);
                });
        },
        change_location: function(op_id, loc_id, is_src_dst){
            var self = this;
            var vals = {'location_dest_id': loc_id};
            if (is_src_dst){
                vals = {'location_id': loc_id};
            }
            return new instance.web.Model('stock.pack.operation')
                .call('write',[op_id, vals])
                .then(function(){
                    return self.refresh_ui(self.picking.id);
                });
        },
        print_package: function(package_id){
            var self = this;
            return new instance.web.Model('stock.quant.package')
                .call('action_print',[[package_id]])
                .then(function(action){
                    return self.do_action(action);
                });
        },
        print_picking: function(){
            var self = this;
            return new instance.web.Model('stock.picking.type').call('read', [[self.picking_type_id], ['code'], new instance.web.CompoundContext()])
                .then(function(pick_type){
                    return new instance.web.Model('stock.picking').call('do_print_picking',[[self.picking.id]])
                           .then(function(action){
                                return self.do_action(action);
                           });
                });
        },
        picking_next: function(){
            for(var i = 0; i < this.pickings.length; i++){
                if(this.pickings[i] === this.picking.id){
                    if(i < this.pickings.length -1){
                        $.bbq.pushState('picking_id='+this.pickings[i+1]);
                        this.refresh_ui(this.pickings[i+1]);
                        return;
                    }
                }
            }
        },
        picking_prev: function(){
            for(var i = 0; i < this.pickings.length; i++){
                if(this.pickings[i] === this.picking.id){
                    if(i > 0){
                        $.bbq.pushState('picking_id='+this.pickings[i-1]);
                        this.refresh_ui(this.pickings[i-1]);
                        return;
                    }
                }
            }
        },
        delete_package_op: function(pack_id){
            var self = this;
            return new instance.web.Model('stock.pack.operation').call('search', [[['result_package_id', '=', pack_id]]])
                .then(function(op_ids) {
                    return new instance.web.Model('stock.pack.operation').call('write', [op_ids, {'result_package_id':false}])
                        .then(function() {
                            return self.refresh_ui(self.picking.id);
                        });
                });
        },
        set_operation_quantity: function(quantity, op_id){
            var self = this;
            if(quantity >= 0){
                return new instance.web.Model('stock.pack.operation')
                    .call('write',[[op_id],{'qty_done': quantity }])
                    .then(function(){
                        self.refresh_ui(self.picking.id);
                    });
            }

        },
        set_package_pack: function(package_id, pack){
            var self = this;
                return new instance.web.Model('stock.quant.package')
                    .call('write',[[package_id],{'ul_id': pack }]);
            return;
        },
        reload_pack_operation: function(){
            var self = this;
            return new instance.web.Model('stock.picking')
                .call('do_prepare_partial',[[self.picking.id]])
                .then(function(){
                    self.refresh_ui(self.picking.id);
                });
        },
        quit: function(){
            this.destroy();
            return new instance.web.Model("ir.model.data").get_func("search_read")([['name', '=', 'action_picking_type_form']], ['res_id']).pipe(function(res) {
                    window.location = '/web#action=' + res[0]['res_id'];
                });
        },
        destroy: function(){
            this._super();
            // this.disconnect_numpad();
            this.barcode_scanner.disconnect();
            instance.webclient.set_content_full_screen(false);
        },
    });
    openerp.web.client_actions.add('stock.ui', 'instance.stock.PickingMainWidget');
    
    
    
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

    
    module.PickingProductWidget = module.MobileWidget.extend({
        template: 'PageWidget',
        init: function(parent,params){
            this._super(parent,params);
            var self = this;
            $(window).bind('hashchange', function(){
                var states = $.bbq.getState();
                if (states.action === "stock.products"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.products',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.menu"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.menu',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
                else if (states.action === "stock.ui"){
                    self.do_action({
                        type:   'ir.actions.client',
                        tag:    'stock.ui',
                        target: 'current',
                    },{
                        clear_breadcrumbs: true,
                    });
                }
            });
            init_hash = $.bbq.getState();
            this.product_id = init_hash.product_id ? init_hash.product_id:0;
            this.product = null;
            this.product_template = null;
            this.stock_moves = [];
            this.picking_ids = [];
            this.pickings = [];
            this.picking_type_ids = [];
            this.picking_types = [];
            this.pickings_per_types = [];
            this.loaded = this.load(this.product_id);
        },

        load: function(product_id){
            var self = this;
            if(product_id){
                return new instance.web.Model("product.product")
                    .query(['id','name','ean13','default_code','product_tmpl_id'])
                    .filter([['id', '=', product_id]])
                    .first()
                .then(function(prod) {
                    self.product = prod;
                    self.product.ean13 = self.product.ean13 ? self.product.ean13 : "";
                    return new instance.web.Model("product.template")
                        .query(['id','product_brand_id','qty_available','image_medium','categ_id'])
                        .filter([['id', '=', self.product.product_tmpl_id[0]]])
                        .first()
                }).then(function(product_tmpl) {
                    self.product_template = product_tmpl;
                    self.product.brand = self.product_template.product_brand_id[1] ? self.product_template.product_brand_id[1] : "";
                    self.product.qty_available = self.product_template.qty_available ? self.product_template.qty_available : "";
                    self.product.image_medium = self.product_template.image_medium;
                    self.product.category = self.product_template.categ_id[1];
                    return new instance.web.Model("stock.move")
                        .query(['id','picking_id'])
                        .filter([['product_id', '=', self.product.id]])
                        .all()
                }).then(function(stock_mov) {
                    self.stock_moves = stock_mov;
                    self.picking_ids = [];
                    for(var i = 0; i < stock_mov.length; i++){
                        self.picking_ids.push(stock_mov[i].picking_id[0]);
                    }
                    return new instance.web.Model("stock.picking")
                        .query(['id','name','date','partner_id','state','picking_type_id'])
                        .filter([['id', 'in', self.picking_ids]])
                        .all()
                }).then(function(picks) {
                    self.pickings = picks;
                    self.picking_type_ids = [];
                    for(var i = 0; i < picks.length; i++){
                        self.picking_type_ids.push(picks[i].picking_type_id[0]);
                    }
                    return new instance.web.Model("stock.picking.type")
                        .query(['id','code'])
                        .filter([['id', 'in', self.picking_type_ids]])
                        .all()
                }).then(function(pick_types) {
                    self.picking_types = pick_types;
                }).then(function() {
                    self.pickings_per_types = [];
                    var picking_states = {  draft:"Draft", 
                                            cancel:"Cancelled", 
                                            waiting:"Waiting Another Operation",
                                            partially_available: "Partially Available",
                                            confirmed:"Waiting Availability", 
                                            assigned:"Ready to Transfer", 
                                            done:"Transferred"
                                          };
                    for(var i = 0; i < self.picking_types.length; i++){
                        var type = {};
                        type.name = self.picking_types[i].code.toUpperCase();
                        type.pickings = [];
                        
                        for(var j = 0; j < self.pickings.length; j++){
                            if(self.pickings[j].picking_type_id[0]==self.picking_types[i].id){
                                if(picking_states.hasOwnProperty(self.pickings[j].state)){
                                    self.pickings[j].state = picking_states[self.pickings[j].state];
                                }
                                self.pickings[j].partner = self.pickings[j].partner_id[1];
                                type.pickings.push(self.pickings[j]);
                            }
                        }
                        type.pickings.sort(function(a, b) {return b.date.localeCompare(a.date);});
                        self.pickings_per_types.push(type);
                    }
                });
            }else{
                return []
            }

        },

        start: function(){
            var self = this;
            instance.webclient.set_content_full_screen(true);
            
            this.loaded.then(function(){
               self.$('.content').html(QWeb.render('PickingProductWidget',{product:self.product, pickings_per_types: self.pickings_per_types}));
               self.$('.js_pick_menu').click(function(){ self.menu(); });
               self.$('.js_pick_products').click(function(){ self.goto_products(); });
               self.$('#product_search_box').hide();
               self.$('.js_clear_search').hide();
               self.$('.oe_picking').click(function(){
                        self.goto_picking($(this).data('id'));
                    });
            });
        },

        menu: function(){
            $.bbq.pushState('#action=stock.menu');
            $(window).trigger('hashchange');
        },
        goto_picking: function(picking_id){
            $.bbq.pushState('#action=stock.ui&picking_id='+picking_id);
            $(window).trigger('hashchange');
        },
        goto_products: function(){
            $.bbq.pushState('#action=stock.products');
            $(window).trigger('hashchange');
        },
        quit: function(){
            this.destroy();
            return new instance.web.Model("ir.model.data").get_func("search_read")([['name', '=', 'action_picking_type_form']], ['res_id']).pipe(function(res) {
                    window.location = '/web#action=' + res[0]['res_id'];
                });
        },
        destroy: function(){
            this._super();
            instance.webclient.set_content_full_screen(false);
        },
    });
    openerp.web.client_actions.add('stock.product', 'instance.stock.PickingProductWidget');
    
    
    
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

    

    module.BarcodeScanner = instance.web.Class.extend({
        connect: function(callback){
            var code = "";
            var timeStamp = 0;
            var timeout = null;

            this.handler = function(e){
                if(e.which === 13){ //ignore returns
                    return;
                }

                if(timeStamp + 50 < new Date().getTime()){
                    code = "";
                }

                timeStamp = new Date().getTime();
                clearTimeout(timeout);

                code += String.fromCharCode(e.which);

                timeout = setTimeout(function(){
                    if(code.length >= 3){
                        callback(code);
                    }
                    code = "";
                },100);
            };

            $('body').on('keypress', this.handler);

        },
        disconnect: function(){
            $('body').off('keypress', this.handler);
        },
    });

}

openerp.stock = function(openerp) {
    openerp.stock = openerp.stock || {};
    openerp_picking_widgets(openerp);
}