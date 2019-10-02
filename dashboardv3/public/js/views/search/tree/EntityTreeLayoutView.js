/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define([
    "require",
    "hbs!tmpl/search/tree/EntityTreeLayoutView_tmpl",
    "utils/Utils",
    "utils/Globals",
    "utils/UrlLinks",
    "utils/CommonViewFunction",
    "collection/VSearchList",
    "collection/VGlossaryList",
    "jstree"
], function(require, EntityLayoutViewTmpl, Utils, Globals, UrlLinks, CommonViewFunction, VSearchList, VGlossaryList) {
    "use strict";

    var EntityTreeLayoutview = Marionette.LayoutView.extend({
        template: EntityLayoutViewTmpl,

        regions: {},
        ui: {
            //refresh
            refreshTree: '[data-id="refreshTree"]',
            groupOrFlatTree: '[data-id="groupOrFlatTreeView"]',

            // tree el
            entitySearchTree: '[data-id="entitySearchTree"]',

            // Show/hide empty values in tree
            showEmptyServiceType: '[data-id="showEmptyServiceType"]'
        },
        templateHelpers: function() {
            return {
                apiBaseUrl: UrlLinks.apiBaseUrl
            };
        },
        events: function() {
            var events = {},
                that = this;
            // refresh individual tree
            events["click " + this.ui.refreshTree] = function(e) {
                var type = $(e.currentTarget).data("type");
                e.stopPropagation();
                that.ui[type + "SearchTree"].jstree(true).destroy();
                that.refresh({ type: type });
            };

            // show and hide entities and classifications with 0 numbers
            events["click " + this.ui.showEmptyServiceType] = function(e) {
                e.stopPropagation();
                this.isEmptyServicetype = !this.isEmptyServicetype;
                this.entitySwitchBtnUpdate();
            };
            // refresh individual tree
            events["click " + this.ui.groupOrFlatTree] = function(e) {
                var type = $(e.currentTarget).data("type");
                e.stopPropagation();
                this.isGroupView = !this.isGroupView;
                // this.ui.groupOrFlatTree.attr("data-original-title", (this.isGroupView ? "Show flat tree" : "Show group tree"));
                this.ui.groupOrFlatTree.tooltip('hide');
                // this.ui.groupOrFlatTree.find("i").toggleClass("group-tree-deactivate");
                this.ui.groupOrFlatTree.find("i").toggleClass("fa-sitemap fa-list-ul");
                this.ui.groupOrFlatTree.find("span").html(this.isGroupView ? "Show flat tree" : "Show group tree");

                that.ui[type + "SearchTree"].jstree(true).destroy();
                that.renderEntityTree();
            };

            return events;
        },
        bindEvents: function() {
            var that = this;
            $('body').on('click', '.entityPopoverOptions li', function(e) {
                that.$('.entityPopover').popover('hide');
                that[$(this).find('a').data('fn') + "Entity"](e)
            });
            this.searchVent.on("Entity:Count:Update", function(options) {
                var opt = options || {};
                if (opt && !opt.metricData) {
                    that.metricCollection.fetch({
                        skipDefaultError: true,
                        complete: function() {
                            that.entityCountObj = _.first(that.metricCollection.toJSON());
                            that.ui.entitySearchTree.jstree(true).refresh();
                        }
                    });
                } else {
                    that.entityCountObj = opt.metricData;
                    that.ui.entitySearchTree.jstree(true).refresh();
                }
            });
        },
        initialize: function(options) {
            this.options = options;
            _.extend(
                this,
                _.pick(
                    options,
                    "typeHeaders",
                    "searchVent",
                    "entityDefCollection",
                    "enumDefCollection",
                    "classificationDefCollection",
                    "searchTableColumns",
                    "searchTableFilters",
                    "metricCollection"
                )
            );
            this.bindEvents();
            this.entityCountObj = _.first(this.metricCollection.toJSON());
            this.isEmptyServicetype = true;
            this.entityTreeData = {};
            this.typeId = null;
            this.isGroupView = true;
        },
        onRender: function() {
            this.renderEntityTree();
            this.createEntityAction();
        },
        createEntityAction: function() {
            var that = this;
            Utils.generatePopover({
                el: this.$el,
                contentClass: 'entityPopoverOptions',
                popoverOptions: {
                    selector: '.entityPopover',
                    content: function() {
                        var type = $(this).data('detail'),
                            liString = "<li><i class='fa fa-search'></i><a href='javascript:void(0)' data-fn='onSelectedSearch'>Search</a></li>"
                        return "<ul>" + liString + "</ul>";
                    }
                }
            });
        },
        renderEntityTree: function() {
            var that = this;
            this.generateSearchTree({
                $el: that.ui.entitySearchTree
            });
        },
        onSearchEntityNode: function(showEmptyType) {
            // on tree search by text, searches for all entity node, called by searchfilterBrowserLayoutView.js
            this.isEmptyServicetype = showEmptyType;
            this.entitySwitchBtnUpdate();
        },
        entitySwitchBtnUpdate: function() {
            // this.ui.showEmptyServiceType.attr("title", (this.isEmptyServicetype ? "Show" : "Hide") + " empty service types");
            this.ui.showEmptyServiceType.attr("data-original-title", (this.isEmptyServicetype ? "Show" : "Hide") + " empty service types");
            this.ui.showEmptyServiceType.tooltip('hide');
            this.ui.showEmptyServiceType.find("i").toggleClass("fa-toggle-on fa-toggle-off");
            // this.ui.showEmptyServiceType.find("span").html((this.isEmptyServicetype ? "Show" : "Hide") + " empty service types");
            this.ui.entitySearchTree.jstree(true).refresh();
        },
        manualRender: function(options) {
            var that = this;
            _.extend(this.options, options);
            if (this.options.value === undefined) {
                this.options.value = {};
            }
            if (!this.options.value.type) {
                this.ui.entitySearchTree.jstree(true).deselect_all();
                this.typeId = null;
            } else {
                var dataFound = this.typeHeaders.fullCollection.find(function(obj) {
                    return obj.get("name") === that.options.value.type
                });
                if (dataFound) {
                    if ((this.typeId && this.typeId !== dataFound.get("guid")) || this.typeId === null) {
                        if (this.typeId) {
                            this.ui.entitySearchTree.jstree(true).deselect_node(this.typeId);
                        }
                        this.fromManualRender = true;
                        this.typeId = dataFound.get("guid");
                        this.ui.entitySearchTree.jstree(true).select_node(dataFound.get("guid"));
                    }
                }
            }
        },
        onNodeSelect: function(options) {
            var that = this,
                type,
                name = options.node.original.name,
                selectedNodeId = options.node.id,
                typeValue = null,
                params = {
                    searchType: "basic",
                    dslChecked: false
                };
            if (this.options.value) {
                if (this.options.value.type) {
                    params["type"] = this.options.value.type;
                }
                if (this.options.value.isCF) {
                    this.options.value.isCF = null;
                }
                if (this.options.value.entityFilters) {
                    params["entityFilters"] = null;
                }
            }

            if (that.typeId != selectedNodeId) {
                that.typeId = selectedNodeId;
                typeValue = name;
                params['type'] = typeValue;
            } else {
                that.typeId = params["type"] = null;
                that.ui.entitySearchTree.jstree(true).deselect_all(true);
                if (!that.options.value.type && !that.options.value.tag && !that.options.value.term && !that.options.value.query) {
                    that.showDefaultPage();
                    return;
                }
            }
            var searchParam = _.extend({}, this.options.value, params);
            this.triggerSearch(searchParam);
        },
        showDefaultPage: function() {
            Utils.setUrl({
                url: '!/search',
                mergeBrowserUrl: false,
                trigger: true,
                updateTabState: true
            });
        },
        triggerSearch: function(params, url) {
            var serachUrl = url ? url : '#!/search/searchResult';
            Utils.setUrl({
                url: serachUrl,
                urlParams: params,
                mergeBrowserUrl: false,
                trigger: true,
                updateTabState: true
            });
        },
        onSelectedSearchEntity: function() {
            var params = {
                searchType: "basic",
                dslChecked: false,
                type: this.options.value.type
            };
            this.triggerSearch(params);
        },
        getEntityTree: function() {
            var that = this,
                serviceTypeArr = [],
                serviceTypeWithEmptyEntity = [],
                type = "ENTITY",
                entityTreeContainer = this.ui.entitytreeStructure,
                generateTreeData = function(data) {
                    that.typeHeaders.fullCollection.each(function(model) {
                        var totalCount = 0,
                            serviceType = model.toJSON().serviceType,
                            isSelected = false,
                            categoryType = model.toJSON().category,
                            generateServiceTypeArr = function(entityCountArr, serviceType, children, entityCount) {
                                if (that.isGroupView) {
                                    if (entityCountArr[serviceType]) {
                                        entityCountArr[serviceType]["children"].push(children);
                                        entityCountArr[serviceType]["totalCounter"] = +entityCountArr[serviceType]["totalCounter"] + entityCount;
                                    } else {
                                        entityCountArr[serviceType] = [];
                                        entityCountArr[serviceType]["name"] = serviceType;
                                        entityCountArr[serviceType]["children"] = [];
                                        entityCountArr[serviceType]["children"].push(children);
                                        entityCountArr[serviceType]["totalCounter"] = entityCount;
                                    }
                                } else {
                                    entityCountArr.push(children)
                                }
                            };
                        if (!serviceType) {
                            serviceType = "other_types";
                        }
                        if (categoryType == "ENTITY") {
                            var entityCount =
                                that.entityCountObj.entity.entityActive[model.get("name")] +
                                (that.entityCountObj.entity.entityDeleted[model.get("name")] ?
                                    that.entityCountObj.entity.entityDeleted[model.get("name")] :
                                    0),
                                modelname = entityCount ? model.get("name") + " (" + _.numberFormatWithComa(entityCount) + ")" : model.get("name");
                            if (that.options.value) {
                                isSelected = that.options.value.type ? that.options.value.type == model.get("name") : false;
                                if (!that.typeId) {
                                    that.typeId = isSelected ? model.get("guid") : null;
                                }
                            }
                            // var children = {
                            //     text: modelname,
                            //     name: model.get("name"),
                            //     type: model.get("category"),
                            //     gType: "serviceType",
                            //     guid: model.get("guid"),
                            //     id: model.get("guid"),
                            //     parent: serviceType,
                            //     model: model,
                            //     icon: "fa fa-file-o",
                            //     state: {
                            //         disabled: entityCount == 0 ? true : false,
                            //         selected: isSelected
                            //     },
                            // };

                            var children = {
                                text: modelname,
                                name: model.get("name"),
                                type: model.get("category"),
                                gType: "serviceType",
                                guid: model.get("guid"),
                                id: model.get("guid"),
                                model: model,
                                parent: "#",
                                icon: "fa fa-file-o",
                                state: {
                                    disabled: entityCount == 0 ? true : false,
                                    selected: isSelected
                                },
                            };

                            entityCount = _.isNaN(entityCount) ? 0 : entityCount;
                            generateServiceTypeArr(serviceTypeArr, serviceType, children, entityCount);
                            if (entityCount) {
                                generateServiceTypeArr(serviceTypeWithEmptyEntity, serviceType, children, entityCount);
                            }
                        }
                    });

                    var serviceTypeData = that.isEmptyServicetype ? serviceTypeWithEmptyEntity : serviceTypeArr;
                    if (that.isGroupView) {
                        return getParentsData.call(that, serviceTypeData);
                    } else {
                        return serviceTypeData;
                    }
                },
                getParentsData = function(data) {
                    var parents = Object.keys(data),
                        treeData = [],
                        withoutEmptyServiceType = [],
                        treeCoreData = null,
                        openEntityNodesState = function(treeDate) {
                            if (treeDate.length == 1) {
                                _.each(treeDate, function(model) {
                                    model.state = { opened: true }
                                })
                            }
                        },
                        generateNode = function(children) {
                            var nodeStructure = {
                                text: "Service Types",
                                children: children,
                                icon: "fa fa-folder-o",
                                type: "ENTITY",
                                state: { opened: true },
                                parent: "#"
                            }
                            return nodeStructure;
                        };
                    for (var i = 0; i < parents.length; i++) {

                        var checkEmptyServiceType = false,
                            getParrent = data[parents[i]],
                            totalCounter = getParrent.totalCounter,
                            textName = getParrent.totalCounter ? parents[i] + " (" + _.numberFormatWithComa(totalCounter) + ")" : parents[i],
                            parent = {
                                icon: "fa fa-folder-o",
                                type: type,
                                gType: "serviceType",
                                children: getParrent.children,
                                text: textName,
                                name: data[parents[i]].name,
                                id: i,
                                state: { opened: true }
                            };
                        if (that.isEmptyServicetype) {
                            if (data[parents[i]].totalCounter == 0) {
                                checkEmptyServiceType = true;
                            }
                        }
                        treeData.push(parent);
                        if (!checkEmptyServiceType) {
                            withoutEmptyServiceType.push(parent);
                        }
                    }
                    that.entityTreeData = {
                        withoutEmptyServiceTypeEntity: generateNode(withoutEmptyServiceType),
                        withEmptyServiceTypeEntity: generateNode(treeData)
                    };

                    treeCoreData = that.isEmptyServicetype ? withoutEmptyServiceType : treeData;

                    openEntityNodesState(treeCoreData);
                    return treeCoreData;
                };
            return generateTreeData();
        },
        generateSearchTree: function(options) {
            var $el = options && options.$el,
                data = options && options.data,
                type = options && options.type,
                that = this,
                getEntityTreeConfig = function(opt) {
                    return {
                        plugins: ["search", "core", "sort", "conditionalselect", "changed", "wholerow", "node_customize"],
                        conditionalselect: function(node) {
                            var type = node.original.type;
                            if (type == "ENTITY" || type == "GLOSSARY") {
                                if (node.children.length || type == "GLOSSARY") {
                                    return false;
                                } else {
                                    return true;
                                }
                            } else {
                                return true;
                            }
                        },
                        state: { opened: true },
                        search: {
                            show_only_matches: true,
                            case_sensitive: false
                        },
                        node_customize: {
                            default: function(el) {
                                //$(el).find("a").append("<div><i class='fa fa-ellipsis-h'></i></div>");
                                if ($(el).find(".fa-ellipsis-h").length === 0) {
                                    $(el).append('<div class="tools"><i class="fa fa-ellipsis-h entityPopover" rel="popover"></i></div>');
                                }
                            }
                        },
                        core: {
                            multiple: false,
                            data: function(node, cb) {
                                if (node.id === "#") {
                                    cb(
                                        // {
                                        //     text: "Service Types",
                                        //     children: that.getEntityTree(),
                                        //     icon: "fa fa-folder-o",
                                        //     type: "ENTITY",
                                        //     state: { opened: true },
                                        //     parent: "#"
                                        // }
                                        that.getEntityTree()
                                    );
                                }
                            }
                        }
                    };
                };

            $el.jstree(
                getEntityTreeConfig({
                    type: ""
                })
            ).on("open_node.jstree", function(e, data) {
                that.isTreeOpen = true;
            }).on("select_node.jstree", function(e, data) {
                if (that.fromManualRender !== true) {
                    that.onNodeSelect(data);
                } else {
                    that.fromManualRender = false;
                }
            }).on("search.jstree", function(nodes, str, res) {
                if (str.nodes.length === 0) {
                    $el.jstree(true).hide_all();
                    $el.parents(".panel").addClass("hide");
                } else {
                    $el.parents(".panel").removeClass("hide");
                }
            })
        },
        refresh: function(options) {
            var that = this,
                apiCount = 3,
                renderTree = function() {
                    if (apiCount === 0) {
                        that.renderEntityTree();
                    }
                };
            this.entityDefCollection.fetch({
                skipDefaultError: true,
                complete: function() {
                    that.entityDefCollection.fullCollection.comparator = function(model) {
                        return model.get('name').toLowerCase();
                    };
                    that.entityDefCollection.fullCollection.sort({ silent: true });
                    --apiCount;
                    renderTree();
                }
            });

            this.metricCollection.fetch({
                skipDefaultError: true,
                complete: function() {
                    --apiCount;
                    that.entityCountObj = _.first(that.metricCollection.toJSON());
                    renderTree();
                }
            });

            this.typeHeaders.fetch({
                skipDefaultError: true,
                complete: function() {
                    that.typeHeaders.fullCollection.comparator = function(model) {
                        return model.get('name').toLowerCase();
                    }
                    that.typeHeaders.fullCollection.sort({ silent: true });
                    --apiCount;
                    renderTree();
                }
            });

        }
    });
    return EntityTreeLayoutview;
});