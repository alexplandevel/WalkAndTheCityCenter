import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Layer from 'ol/layer';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Text from 'ol/style/Text';
import Circle from 'ol/style/Circle';
import Stroke from 'ol/style/Stroke';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import * as olProj from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { Vector } from 'ol/source';
import geostats from 'geostats/lib/geostats'
import chroma from 'chroma-js'


let selIndex = 'Score';
let classSeries;
let classColors;

export const setSelIndex =(idx:string):void => {
  selIndex = idx;
}

export const initOSMLayer = (): TileLayer =>{
     const OSMLayer = new TileLayer({
        title: 'OSM',
        visible:true,
        source: new OSM()
      });
    
      return OSMLayer;
}


export const initGOSMLayer = (): TileLayer =>{
     const GOSMLayer = new TileLayer({
      title: 'GOSM',
       visible:false,
       source: new OSM({
       url: 'http://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
       })
     });
     return GOSMLayer;
}


export const initWalkabilityLayer = (): VectorLayer[] =>{
  const WALK = new VectorLayer({
      visible:true,
      title: 'WALK',
      maxResolution: 50,
      opacity:0.7,
      // style: styleFnWalkGrids,
      source:new Vector({
          format: new GeoJSON({
            defaultDataProjection:'EPSG:3857',
            featureProjection:'EPSG:3857',
            geometryName:'geometry'
          }),
          wrapX:false
      })
  })
   return WALK;
}


export const initCityBoundsLayer = (): VectorLayer[] =>{
    const CITY_BNDS = new VectorLayer({
        visible:true,
        title: 'CITY_BNDS',
        style: styleFnCities,
        minResolution: 50,
        source:new Vector({
            format: new GeoJSON({
              defaultDataProjection:'EPSG:3857',
              featureProjection:'EPSG:3857',
              geometryName:'geometry'
            }),
            url: 'assets/geodata/city_boundaries1.json',
            wrapX:false
        })
    })
     return CITY_BNDS;
}


export const styleFnCities = (feature:Feature, resolution:number): Style => {
    let retStyle:Style;
    if (resolution<200){
      retStyle = new Style({
        fill: new Fill({
          color: [255, 0, 0, 0]
        }),
        stroke: new Stroke({
          color: [255, 255, 0, 1],
          width: 4
        })
      })
    } else {
      retStyle = new Style({
        image: new Circle({
          radius: 7,
          fill: new Fill({color: 'green'}),
          stroke: new Stroke({
            color: [0,0,255], 
            width: 2
          })
        }),
        geometry: (myfeature) => {
          var retPoint;
          if (myfeature.getGeometry().getType() === 'MultiPolygon') {
            retPoint = getMaxPoly(myfeature.getGeometry().getPolygons()).getInteriorPoint();
          } else if (myfeature.getGeometry().getType() === 'Polygon') {
            retPoint = myfeature.getGeometry().getInteriorPoint();
          }
          return retPoint;
        },
      })
    }
    return retStyle;
}

export const highlightStyle = (feature:Feature, resolution:number): Style => {
  let retStyle:Style;
  if (resolution<200){
    retStyle = new Style({
      fill: new Fill({
        color: [255, 0, 0, 0.5]
      }),
      stroke: new Stroke({
        color: [0, 255, 0, 1],
        width: 6
      })
    })
  } else {
    retStyle = new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({color: 'black'}),
        stroke: new Stroke({
          color: [0,0,255], 
          width: 4
        })
      }),
      text: new Text({
        font: '14px Calibri,sans-serif',
        fill: new Fill({ color: '#000' }),
        stroke: new Stroke({
          color: '#fff', width: 2
        }),
        text: feature.get('City')
      }),
      geometry: (myfeature) => {
        var retPoint;
        if (myfeature.getGeometry().getType() === 'MultiPolygon') {
          retPoint = getMaxPoly(myfeature.getGeometry().getPolygons()).getInteriorPoint();
        } else if (myfeature.getGeometry().getType() === 'Polygon') {
          retPoint = myfeature.getGeometry().getInteriorPoint();
        }
        return retPoint;
      },
    })
  }
  return retStyle;
};


export const switchTileLayer = (val:string, osm:TileLayer, gosm:TileLayer) =>{
  if (val === "OSM"){
      osm.setVisible(true); 
      gosm.setVisible(false);
    } 
    else if (val === "GOSM"){
      osm.setVisible(false); 
      gosm.setVisible(true);
    } 
    else if (val === "NONE"){
      osm.setVisible(false); 
      gosm.setVisible(false);
    } 
}


export const getAndSetClassesFromData = (data:any) => {
  let retObj = {};
  if (data.length>0){
    
    data = data.map(vals => {
      return Number(vals.toFixed(2));
    });
    let serie = new geostats(data);
    serie.getClassQuantile(10);
    let colors = chroma.scale([[253, 231, 37, 1],[30, 158, 137, 1], [68, 1, 84, 1]]).colors(10);
    serie.setColors(colors);
    classSeries = serie;
    classColors = colors;
    document.getElementById('legend').innerHTML = serie.getHtmlLegend(null, "Walkability. Index:"+selIndex,1);
    retObj= {
      'ser':serie, 
      'cols':colors
    };
  }
  return retObj;
}

export const styleFnWalkGrids = (feature:Feature, resolution:number): Style => {
  const currVal = parseFloat(feature.get(selIndex));
  const bounds = classSeries.bounds;
  let numRanges = new Array();
  for (let i = 0; i < bounds.length-1; i++) { 
  numRanges.push({
      min: parseFloat(bounds[i]),
      max: parseFloat(bounds[i+1])
    });  
  }  
  var classIndex = verifyClassFromVal(numRanges, currVal);
  var polyStyleConfig = {
    stroke: new Stroke({
      color: [255, 255, 0, 0],
      width: 0
    }),
    fill: new Fill({
      color: classColors[classIndex]
    }),
  };
return new Style(polyStyleConfig);
}

export const verifyClassFromVal = (rangevals, val) => {
  let retIndex = -1;
  let valRound = Number(val.toFixed(2))
  for (let i = 0; i < rangevals.length; i++) {
    if (valRound >= rangevals[i].min && valRound <= rangevals[i].max) {
      retIndex = i;
    } 
  }
  return retIndex;
}

/**
 *    get the maximum polygon out of the supllied  array of polygons
 */
export const getMaxPoly = (polys:Polygon[]) => {
  let polyObj = [];
  for (let b = 0; b < polys.length; b++) {
    polyObj.push({
      poly: polys[b],
      area: polys[b].getArea()
    });
  }
  polyObj.sort((a, b) => a.area - b.area);
  return polyObj[polyObj.length - 1].poly;
}



