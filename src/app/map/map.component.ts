import { Component, OnInit } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import { Vector } from 'ol/source';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import * as olProj from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import {defaults as defaultControls} from 'ol/control'; 
import Overlay from 'ol/Overlay';
import {initOSMLayer, initGOSMLayer,initCityBoundsLayer,
  initWalkabilityLayer,switchTileLayer,setSelIndex,
  getAndSetClassesFromData,styleFnWalkGrids,highlightStyle} from './map.helper';
import {setSelIndexDownCntlr} from './customControls/downloadControl';

import {legendControl} from './customControls/legendControl';
import {zoomToWorldControl} from './customControls/zoomToWorldControl';
import {downloadControl} from './customControls/downloadControl';
import {zoomInOutControl} from './customControls/zooomInOutControl';
import mappingsData from '../../assets/geodata/lookup.json';

// ng build --prod --base-href /walkandthecitycenter/

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {
  

  constructor() { }

  title = 'ol3-ng';
  dataLoaded:boolean;
  map: Map;
  popupCloser: any;
  this_:MapComponent;

  OSM: TileLayer;
  GOSM: TileLayer;
  CITY_BNDS: VectorLayer;
  WALK: VectorLayer;

  overlayPopup:Overlay;
  selectedCity:Feature;
  hoveredCity:Feature;
  selectedIndex:string;
  mappings:any = mappingsData.lookups;
  walkOpacity:number;



  ngOnInit(){
    this.OSM = initOSMLayer();
    this.GOSM = initGOSMLayer();
    this.CITY_BNDS = initCityBoundsLayer();
    this.WALK = initWalkabilityLayer();
    this.selectedIndex ="Score";
    this.popupCloser = document.getElementById('popup-closer');
    this.dataLoaded = true;
    this.hoveredCity = null;
    this.selectedCity = null;
    this.walkOpacity = 70;
       
   
    const this_ = this;
    const layers = [this.OSM, this.GOSM, this.WALK, this.CITY_BNDS];
    this.overlayPopup = new Overlay({
      element: document.getElementById('popup'),
      autoPan: true,
      autoPanAnimation: {
        duration: 250,
      },
    });

    this.popupCloser.onclick = ():boolean => {
      this_.overlayPopup.setPosition(undefined);
      this_.popupCloser.blur();
      return false;
    };


    this.map = new Map({
      target: 'walk_map',
      layers: layers,
      overlays: [this.overlayPopup],
      controls: defaultControls({zoom:false,attribution : false}).extend([
        new legendControl(), 
        new zoomToWorldControl(),
        new downloadControl(),
        new zoomInOutControl()
      ]),
      view: new View({
        center: olProj.fromLonLat([15.0785, 51.4614]),
        zoom: 1
      })
    });

    this.CITY_BNDS.once('change', () => {
      this_.zoomToCities();
      this_.map.updateSize();
    })
    
    
    this.map.on('click', (event) => {
      this_.overlayPopup.setPosition(undefined);
      this_.map.forEachFeatureAtPixel(event.pixel, (feature,layer) => {
        if (layer.get("title")==="WALK"){
          const keys = feature.getKeys();
          let attrsTable ='<table class="mat-table  cdk-table"><tbody>';
          keys.filter( el => ['OBJECTID','geometry','Shape_Area','Shape_Leng'].indexOf( el ) < 0).forEach(key => {
              if (this_.getTitleFromMappingCode(key).length ===1){
                attrsTable += '<tr class="mat-row"><td class="mat-cell">'+this_.getTitleFromMappingCode(key)[0].indiname+':</td><td>'+parseFloat(feature.get(key)).toFixed(2)+'</td></tr>';
              } else {
                attrsTable += '<tr class="mat-row"><td class="mat-cell">'+key+':</td><td>'+feature.get(key)+'</td></tr>';
              }
          });
          attrsTable += '</tbody></table>';
          document.getElementById('popup-content').innerHTML = attrsTable;
          this_.overlayPopup.setPosition(event.coordinate);
          return;
        } else if (layer.get("title")==="CITY_BNDS") {
          if (this_.selectedCity){
            this_.selectedCity.setStyle(undefined);
          }
          this_.selectedCity = feature;
          this_.selectedCity.setStyle(highlightStyle)
          this_.loadAndZoomToCity();
          this_.overlayPopup.setPosition(undefined);
        } else {
          this_.overlayPopup.setPosition(undefined);
        }
      });
  });


  this.map.on('pointermove', (e) => {
    if (this.hoveredCity){
      if (this.selectedCity !== this.hoveredCity){
        this.hoveredCity.setStyle(undefined);
        this.hoveredCity = null;
      }
      this_.map.getViewport().style.cursor = '';
    } 
    this_.map.forEachFeatureAtPixel(e.pixel,(f) => {
        this.hoveredCity = f;
        this.hoveredCity.setStyle(highlightStyle);
        this.setPointerStyle(e);
        return true;
    },{
      layerFilter : (lyr) => {
        return lyr.get('title') === 'CITY_BNDS';
      }
    });
  });

  }

  setPointerStyle = (e) => {
    const pixel = this.map.getEventPixel(e.originalEvent);
    const hit = this.map.hasFeatureAtPixel(pixel);
    this.map.getViewport().style.cursor = hit ? 'pointer' : '';
  }

  setDisplayIndex = (val:string): void =>{   
    this.dataLoaded = false; 
    this.overlayPopup.setPosition(undefined); 
    this.selectedIndex = val;
    setSelIndex(val);
    setSelIndexDownCntlr(val);
    const vals = new Array();
    this.WALK.getSource().getFeatures().forEach((feat)=>{
        vals.push(feat.get(this.selectedIndex))
        })
    getAndSetClassesFromData(vals);
    if (vals.length === 0){
      this.dataLoaded = true; 
    }
    let this_ = this;
    this.WALK.getSource().refresh();
    this.WALK.getSource().once('change', () => {
      if (this_.WALK.getSource().getState() == 'ready') {
        this.dataLoaded = true; 
      }
    });
    
  }

  zoomToSelCityExtent = ():void => {
     this.map.getView().fit(this.selectedCity.getGeometry().getExtent(),{
      padding:[100,100,100,100],
       size:this.map.getSize(),
       duration: 2000
     });
  }

  loadAndZoomToCity = ():void => {
    this.dataLoaded = false; 
    const newSource = new Vector({
      format: new GeoJSON({
        defaultDataProjection:'EPSG:3857',
        featureProjection:'EPSG:3857',
        geometryName:'geometry'
      }),
      url: 'assets/geodata/'+ this.selectedCity.get('City').toLowerCase() +'.json',
      wrapX:false
    })
    this.WALK.getSource().clear();
    this.WALK.setSource(newSource);
    this.WALK.getSource().refresh();
    console.log('newSource.getState()',newSource.getState())
    newSource.once('change', () => {
      if (newSource.getState() == 'ready') {
        const vals = new Array();
        newSource.getFeatures().forEach((feat)=>{
          vals.push(feat.get(this.selectedIndex))
        })
      getAndSetClassesFromData(vals);
      this.WALK.setStyle(styleFnWalkGrids);
      this.dataLoaded = true;
      }
    })
    this.zoomToSelCityExtent();
  }

  setTileLayer = (val:string): void =>{     
    switchTileLayer(val, this.OSM, this.GOSM);
  }
 

  getTitleFromMappingCode = (code:string):any[] => {
    return this.mappings.filter( (elem) => {
      return elem.Code === code;
    });
  }

  zoomToCities = ():void => {
    this.map.getView().fit(
      this.CITY_BNDS.getSource().getExtent(),{
      padding:[100,100,100,100],
       size:this.map.getSize(),
       duration: 2000
     });
  }

  showSelector = ():boolean =>{
    if (this.dataLoaded && this.map.getView().getResolution()<=50){
      return true;
    } else {
      return false;
    }

  }

  setLyrOpacity = (event):void => {
    this.walkOpacity = event.value;
    this.WALK.setOpacity(this.walkOpacity/100);
    
  }
}