/*eslint angular/di: [2,"array"]*/
/*eslint angular/document-service: 2*/
/*eslint max-len: [2,90]*/
/**
 * Map Service
 */
angular.module('SolrHeatmapApp')
    .factory('Map', ['$rootScope', '$filter', '$document',
        function($rootScope, $filter, $document) {

            var map = {},
                defaults = {
                    renderer: 'canvas',
                    view: {
                        center: [0 ,0],
                        projection: 'EPSG:3857',
                        zoom: 2
                    }
                },
                rs = $rootScope;

            /**
             *
             */
            function init(config) {
                var viewConfig = angular.extend(defaults.view,
                                                    config.mapConfig.view),
                    rendererConfig = angular.extend(defaults.renderer,
                                                    config.mapConfig.renderer),
                    layerConfig = config.mapConfig.layers;

                map = new ol.Map({
                    controls: ol.control.defaults().extend([
                        new ol.control.ScaleLine(),
                        new ol.control.ZoomSlider()
                    ]),
                    interactions: ol.interaction.defaults(),
                    layers: buildMapLayers(layerConfig),
                    renderer: angular.isString(rendererConfig) ?
                                            rendererConfig : undefined,
                    target: 'map',
                    view: new ol.View({
                        center: angular.isArray(viewConfig.center) ?
                                viewConfig.center : undefined,
                        maxZoom: angular.isNumber(viewConfig.maxZoom) ?
                                viewConfig.maxZoom : undefined,
                        minZoom: angular.isNumber(viewConfig.minZoom) ?
                                viewConfig.minZoom : undefined,
                        projection: angular.isString(viewConfig.projection) ?
                                viewConfig.projection : undefined,
                        resolution: angular.isString(viewConfig.resolution) ?
                                viewConfig.resolution : undefined,
                        resolutions: angular.isArray(viewConfig.resolutions) ?
                                viewConfig.resolutions : undefined,
                        rotation: angular.isNumber(viewConfig.rotation) ?
                                viewConfig.rotation : undefined,
                        zoom: angular.isNumber(viewConfig.zoom) ?
                                viewConfig.zoom : undefined,
                        zoomFactor: angular.isNumber(viewConfig.zoomFactor) ?
                                viewConfig.zoomFactor : undefined
                    })
                });

                if (angular.isArray(viewConfig.extent)) {
                    var vw = map.getView();
                    vw.set('extent', viewConfig.extent);
                    createOrUpdateBboxLayer(viewConfig.extent, viewConfig.projection);
                }
            }

            /**
             *
             */
            function buildMapLayers(layerConfig) {
                var layer,
                    layers = [];

                if (angular.isArray(layerConfig)) {
                    angular.forEach(layerConfig, function(conf) {
                        if (conf.type === 'TileWMS') {
                            layer = new ol.layer.Tile({
                                name: conf.name,
                                backgroundLayer: conf.backgroundLayer,
                                displayInLayerPanel: conf.displayInLayerPanel,
                                source: new ol.source.TileWMS({
                                    attributions: [new ol.Attribution({
                                        html: conf.attribution
                                    })],
                                    crossOrigin: conf.crossOrigin,
                                    logo: conf.logo,
                                    params: conf.params,
                                    ratio: conf.ratio,
                                    resolutions: conf.resoltions,
                                    url: conf.url
                                }),
                                opacity: conf.opacity,
                                visible: conf.visible
                            });
                        }
                        if (conf.type === 'ImageWMS') {
                            layer = new ol.layer.Image({
                                name: conf.name,
                                backgroundLayer: conf.backgroundLayer,
                                displayInLayerPanel: conf.displayInLayerPanel,
                                source: new ol.source.ImageWMS({
                                    attributions: [new ol.Attribution({
                                        html: conf.attribution
                                    })],
                                    crossOrigin: conf.crossOrigin,
                                    logo: conf.logo,
                                    params: conf.params,
                                    resolutions: conf.resoltions,
                                    url: conf.url
                                }),
                                opacity: conf.opacity,
                                visible: conf.visible
                            });
                        }
                        layers.push(layer);
                    });
                }
                return layers;
            }

            /**
             *
             */
            function getLayersBy(key, value) {
                var layers = getMap().getLayers().getArray();
                return $filter('filter')(layers, function(layer) {
                    return layer.get(key) === value;
                });
            }

            /**
             *
             */
            function getInteractionsByClass(value) {
                var interactions = solrHeatmapApp.map.
                                    getInteractions().getArray();
                return $filter('filter')(interactions, function(interaction) {
                    return interaction instanceof value;
                });
            }

            /**
             *
             */
            function getInteractionsByType(interactions, type) {
                return $filter('filter')(interactions, function(interaction) {
                    return interaction.type_ === type;
                });
            }

            /**
             *
             */
            function getMap() {
                return map;
            }

            /**
             *
             */
            function displayFeatureInfo(evt) {
                var coord = evt.coordinate,
                    feature = map.forEachFeatureAtPixel(evt.pixel,
                            function(feat, layer) {
                                return feat;
                            }),
                    msg = '',
                    evtCnt = 0,
                    lyrCnt = 0,
                    container = $document[0].getElementById('popup'),
                    content = $document[0].getElementById('popup-content'),
                    closer = $document[0].getElementById('popup-closer'),
                    overlay = new ol.Overlay({
                        element: container,
                        autoPan: true,
                        autoPanAnimation: {
                            duration: 250
                        }
                    });

                closer.onclick = function() {
                    overlay.setPosition(undefined);
                    closer.blur();
                    return false;
                };

                // remove any existing overlay before adding a new one
                map.getOverlays().clear();
                map.addOverlay(overlay);

                if (feature) {
                    var data = feature.get('origVal');
                    if (data) {
                        $rootScope.$broadcast('featureInfoLoaded', data);
                    }
                }

                rs.$on('featureInfoLoaded', function(event, dta) {
                    msg += '<h5>Number of elements: </h5>' + data;
                    content.innerHTML = msg;
                    var overlayFi = solrHeatmapApp.
                                map.getOverlays().getArray()[0];
                    if (overlayFi) {
                        overlayFi.setPosition(coord);
                    }
                });

            }

            function createOrUpdateHeatMapLayer(data) {
                var olVecSrc = createHeatMapSource(data),
                    existingHeatMapLayers = getLayersBy('name', 'HeatMapLayer'),
                    newHeatMapLayer;
                if (existingHeatMapLayers && existingHeatMapLayers.length > 0){
                    var currHeatmapLayer = existingHeatMapLayers[0];
                    // Update layer source
                    var layerSrc = currHeatmapLayer.getSource();
                    if (layerSrc){
                        layerSrc.clear();
                    }
                    currHeatmapLayer.setSource(olVecSrc);
                } else {
                    newHeatMapLayer = new ol.layer.Heatmap({
                        name: 'HeatMapLayer',
                        source: olVecSrc,
                        radius: 10
                    });
                    map.addLayer(newHeatMapLayer);
                }
            }

            /*
             *
             */
            function createHeatMapSource(hmParams) {
                var counts_ints2D = hmParams.counts_ints2D,
                    gridLevel = hmParams.gridLevel,
                    gridColumns = hmParams.columns,
                    gridRows = hmParams.rows,
                    minX = hmParams.minX,
                    minY = hmParams.minY,
                    maxX = hmParams.maxX,
                    maxY = hmParams.maxY,
                    hmProjection = hmParams.projection,
                    dx = maxX - minX,
                    dy = maxY - minY,
                    sx = dx / gridColumns,
                    sy = dy / gridRows,
                    olFeatures = [],
                    minMaxValue,
                    sumOfAllVals = 0,
                    olVecSrc;

                if (!counts_ints2D) {
                    return null;
                }
                minMaxValue = heatmapMinMax(counts_ints2D, gridRows, gridColumns);
                for (var i = 0 ; i < gridRows ; i++){
                    for (var j = 0 ; j < gridColumns ; j++){
                        var hmVal = counts_ints2D[counts_ints2D.length-i-1][j],
                            lon,
                            lat,
                            feat,
                            coords;

                        if (hmVal && hmVal !== null){
                            lat = minY + i*sy + (0.5 * sy);
                            lon = minX + j*sx + (0.5 * sx);
                            coords = ol.proj.transform(
                              [lon, lat],
                              hmProjection,
                              map.getView().getProjection().getCode()
                            );

                            feat = new ol.Feature({
                                geometry: new ol.geom.Point(coords)
                            });

                            // needs to be rescaled.
                            var scaledValue = rescaleHeatmapValue(hmVal,minMaxValue);
                            feat.set('weight', scaledValue);
                            feat.set('origVal', hmVal);

                            olFeatures.push(feat);
                        }
                    }
                }

                olVecSrc = new ol.source.Vector({
                    features: olFeatures,
                    useSpatialIndex: true
                });
                return olVecSrc;
            }



            function heatmapMinMax(heatmap, stepsLatitude, stepsLongitude){
                var max = -1;
                var min = Number.MAX_VALUE;
                for (var i = 0 ; i < stepsLatitude ; i++){
                    var currentRow = heatmap[i];
                    if (currentRow === null){
                        heatmap[i] = currentRow = [];
                    }
                    for (var j = 0 ; j < stepsLongitude ; j++){
                        if (currentRow[j] === null){
                            currentRow[j] = -1;
                        }

                        if (currentRow[j] > max){
                            max = currentRow[j];
                        }

                        if (currentRow[j] < min && currentRow[j] > -1){
                            min = currentRow[j];
                        }
                    }
                }
                return [min, max];
            }

            function rescaleHeatmapValue(value, minMaxValue){
                if (value === null){
                    return 0;
                }

                if (value === -1){
                    return -1;
                }

                if (value === 0){
                    return 0;
                }

                if ((minMaxValue[1] - minMaxValue[0]) === 0){
                    return 0;
                }

                return (value - minMaxValue[0]) /
                        (minMaxValue[1] - minMaxValue[0]);
            }

            /**
             * Helper method to reset the map
             */
            function resetMap() {
                // Reset view
                var intitalCenter = solrHeatmapApp.initMapConf.view.center,
                    intitalZoom = solrHeatmapApp.initMapConf.view.zoom;
                if (intitalZoom && intitalCenter) {
                    var vw = map.getView();
                    vw.setCenter(intitalCenter);
                    vw.setZoom(intitalZoom);
                    createOrUpdateBboxLayer(solrHeatmapApp.initMapConf.view.extent);
                }
            }

            /*
             * Layer which holds the query bbox (q.geo)
             */
            function createOrUpdateBboxLayer (bboxFeature, fromSrs) {
                var polygon = new ol.Feature(ol.geom.Polygon.fromExtent(bboxFeature)),
                    polySrc,
                    existingBboxLayer = getLayersBy('name', 'BoundingBoxLayer'),
                    style = new ol.style.Style({
                      stroke: new ol.style.Stroke({
                        color: '#000000',
                        width: 1
                      })
                    });

                if (fromSrs !== map.getView().getProjection().getCode()){
                    var polygonNew = ol.proj.transformExtent(bboxFeature, fromSrs,
                                                map.getView().getProjection().getCode());
                    polygon = new ol.Feature(ol.geom.Polygon.fromExtent(polygonNew));
                }

                polySrc = new ol.source.Vector({
                    features: [polygon]
                });

                if (existingBboxLayer && existingBboxLayer.length > 0){
                    var currBboxLayer = existingBboxLayer[0];
                    // Update layer source
                    var layerSrc = currBboxLayer.getSource();
                    if (layerSrc){
                      layerSrc.clear();
                    }
                    currBboxLayer.setSource(polySrc);
                    currBboxLayer.setStyle(style);
                } else {
                     var newBboxLayer = new ol.layer.Heatmap({
                       name: 'BoundingBoxLayer',
                       source: polySrc,
                       style: style
                   });

                  map.addLayer(newBboxLayer);

                  // add interactions
                  var select = new ol.interaction.Select({
                      condition: function(mapBrowserEvent) {
                          return ol.events.condition.click(mapBrowserEvent) &&
                              ol.events.condition.altKeyOnly(mapBrowserEvent);
                        },
                      wrapX: false
                   });

                   var modify = new ol.interaction.Modify({
                     features: select.getFeatures()
                   });

                   map.addInteraction(select);
                   map.addInteraction(modify);

                   // TODO:
                   // * restrict modify feature only to bbox
                   // * trigger heatmap recalculation when modification ended
                   // * => modifyend event

                   // Zoom Evenet muss interactions zurücksetzen

                }



            var ms = {
                //map: map,
                init: init,
                getMap: getMap,
                getLayersBy: getLayersBy,
                getInteractionsByClass: getInteractionsByClass,
                getInteractionsByType: getInteractionsByType,
                displayFeatureInfo: displayFeatureInfo,
                createOrUpdateHeatMapLayer: createOrUpdateHeatMapLayer,
                createOrUpdateBboxLayer : createOrUpdateBboxLayer,
                createHeatMapSource: createHeatMapSource,
                heatmapMinMax: heatmapMinMax,
                rescaleHeatmapValue: rescaleHeatmapValue,
                resetMap: resetMap
            };

            return ms;

        }]

);
