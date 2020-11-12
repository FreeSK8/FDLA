//DateTime, Voltage, Motor Temp, Mosfet Temp, DutyCycle, Motor Current, Battery Current, eRPM, eDistance, ESC ID
var units=["V","°C","°C","%","A","A","e","e","m","km/h"]
var axes_names=units.filter(function(item, pos, self) {
    return self.indexOf(item) == pos;
})
var colors=["blue","red","orange","green","purple","fuchsia","white","yellow","darkcyan", "gold"]
var fill=["rgba(0, 0, 255, 0.2)","rgba(255, 0, 0, 0.2)","rgba(255, 165, 0, 0.2)","rgba(0, 255, 0, 0.2)","rgba(128, 0, 128, 0.2)","rgba(255, 0, 255, 0.2)","rgba(255, 255, 255, 0.2)","rgba(255, 255, 0, 0.0)","rgba(0, 139, 139, 0.2)","rgba(255, 215, 0, 0.2)"]
var series_shown=[true,true,true,false,true,false,false,false,false,true];
var Times=[];
var TempPcbs=[];
var TempMotors=[];
var MotorCurrents=[];
var BatteryCurrents=[];
var DutyCycles=[];
var Speeds=[];
var InpVoltages=[];
//var AmpHours=[];
//var AmpHoursCharged=[];
//var WattHours=[];
//var WattHoursCharged=[];
var Distances=[];
var Powers=[];
var Faults=[];
//var TimePassedInMss=[];
var latlngs=[];
var Altitudes=[];
var GPSSpeeds=[];
var names = [];
var data = [];
var curr_plot_indx=0;
var curr_map_indx=0;
var map;
var uplot;
var menu_visible=false;
var map_popup;
var first_esc_id = null;
var multi_esc_mode = false;

//uplot plugins
function touchZoomPlugin(opts) {
  function init(u, opts, data) {
    let plot = u.root.querySelector(".u-over");
    let rect, oxRange, oyRange, xVal, yVal;
    let fr = {x: 0, y: 0, dx: 0, dy: 0};
    let to = {x: 0, y: 0, dx: 0, dy: 0};

    function storePos(t, e) {
      let ts = e.touches;

      let t0 = ts[0];
      let t0x = t0.clientX - rect.left;
      let t0y = t0.clientY - rect.top;

      if (ts.length == 1) {
        t.x = t0x;
        t.y = t0y;
        t.d = 0;
      }
      else {
        let t1 = e.touches[1];
        let t1x = t1.clientX - rect.left;
        let t1y = t1.clientY - rect.top;

        let xMin = Math.min(t0x, t1x);
        let yMin = Math.min(t0y, t1y);
        let xMax = Math.max(t0x, t1x);
        let yMax = Math.max(t0y, t1y);

        // midpts
        t.y = (yMin+yMax)/2;
        t.x = (xMin+xMax)/2;

        t.dx = xMax - xMin;
        t.dy = yMax - yMin;

        // dist
        t.d = Math.sqrt(t.dx * t.dx + t.dy * t.dy);
      }
    }

    let rafPending = false;

    function zoom() {
      rafPending = false;

      let left = to.x;
      let top = to.y;

      // non-uniform scaling
    //  let xFactor = fr.dx / to.dx;
    //  let yFactor = fr.dy / to.dy;

      // uniform x/y scaling
      let xFactor = fr.d / to.d;
      let yFactor = fr.d / to.d;

      let leftPct = left/rect.width;
      let btmPct = 1 - top/rect.height;

      let nxRange = oxRange * xFactor;
      let nxMin = xVal - leftPct * nxRange;
      let nxMax = nxMin + nxRange;

      let nyRange = oyRange * yFactor;
      let nyMin = yVal - btmPct * nyRange;
      let nyMax = nyMin + nyRange;

      u.batch(() => {
        u.setScale("x", {
          min: nxMin,
          max: nxMax,
        });

        u.setScale("y", {
          min: nyMin,
          max: nyMax,
        });
      });
    }

    function touchmove(e) {
      storePos(to, e);

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(zoom);
      }
    }

    plot.addEventListener("touchstart", function(e) {
      rect = plot.getBoundingClientRect();

      storePos(fr, e);

      oxRange = u.scales.x.max - u.scales.x.min;
      oyRange = u.scales.y.max - u.scales.y.min;

      let left = fr.x;
      let top = fr.y;

      xVal = u.posToVal(left, "x");
      yVal = u.posToVal(top, "y");

      document.addEventListener("touchmove", touchmove, {passive: true});
    });

    plot.addEventListener("touchend", function(e) {
      document.removeEventListener("touchmove", touchmove, {passive: true});
    });
  }

  return {
    hooks: {
      init
    }
  };
}

//utils

function compare_filetimes(a, b) {
  if (a.time > b.time) return 1;
  if (b.time > a.time) return -1;

  return 0;
}

function getAllIndexes(arr, val) {
    var indexes = [], i;
    for(i = 0; i < arr.length; i++)
        if (arr[i] === val)
            indexes.push(i);
    return indexes;
}

function handleError(txt){
  var span = document.createElement('span');
  span.innerHTML = txt;
  document.getElementById("loader_sec").appendChild(span)
  show_loader()
}

function get_Log(url){
    // read text from URL location
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.send(null);
  request.onreadystatechange = function () {
    if (request.readyState === 4){
      if (request.status === 200) {
        var type = request.getResponseHeader('Content-Type');
        if (type.indexOf("text") !== 1) {
          parse_LogFile(request.responseText)
        }
      } else {
        handleError("Error Fetching Log: " + request.status + " " +request.statusText)
      }
    }
  }
}

function print_data(){
  console.log(names);
  console.log(data);
}

function throttle(cb, limit) {
  var wait = false;
  return () => {
    if (!wait) {
      requestAnimationFrame(cb);
      wait = true;
      setTimeout(() => {
        wait = false;
      }, limit);
    }
  }
}

function show_upload(){
  console.log("Showing Upload section");
  document.getElementById("loader_sec").style.visibility = "hidden";
  document.getElementById("content_sec").style.visibility = "hidden";
  document.getElementById("upload_sec").style.visibility = "visible";
}

function show_loader(){
  console.log("Showing Loader section");
  document.getElementById("loader_sec").style.visibility = "visible";
  document.getElementById("content_sec").style.visibility = "hidden";
  document.getElementById("upload_sec").style.visibility = "hidden";
}

function show_content(){
  console.log("Showing Content section");
  document.getElementById("loader_sec").style.visibility = "hidden";
  document.getElementById("content_sec").style.visibility = "visible";
  document.getElementById("upload_sec").style.visibility = "hidden";
}

function menu_click(e){
  e.classList.toggle("change");
  if (menu_visible) {
    document.getElementById("menu_list").style.visibility = "hidden";
    menu_visible=false;
  } else {
    document.getElementById("menu_list").style.visibility = "visible";
    menu_visible=true;
  }
}

function cb_change(e){
  if (event.target.checked) {
    var i = names.indexOf(e.target.id.substr(3))
    uplot.setSeries((i+1),{show:true})
    series_shown[i]=true;
  } else {
    var i = names.indexOf(e.target.id.substr(3))
    uplot.setSeries((i+1),{show:false})
    series_shown[i]=false;
  }
}

function fill_menu(){
  for (var i in names){
    i=parseInt(i);
    var li=document.createElement('li');

    var checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.id= "cb_"+names[i];
    checkbox.addEventListener('change',cb_change);

    var label = document.createElement('label')
    label.htmlFor = "cb_"+names[i];
    label.appendChild(document.createTextNode(names[i]));

    li.appendChild(checkbox);
    li.appendChild(label);
    document.getElementById('menu_list').appendChild(li);
    if (series_shown[i]){
      checkbox.checked = true;
      uplot.setSeries((i+1),{show:true})
    } else {
      checkbox.checked = false;
      uplot.setSeries((i+1),{show:false});
    }
  }
}

function find_closest_ind(coord){
  var closest_ind=0;
  var closest_distance=9999999;
  for (var i in latlngs){
    var dist = coord.distanceTo(latlngs[i])
    if (dist < closest_distance){
      closest_distance=dist;
      closest_ind=i;
    }
  }
  if (closest_distance<200){
    return closest_ind;
  }
  return -1;
}

function create_map(){
  map = L.map('mapid').setView(latlngs[0], 13);
  var map1 = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 21,
      id: 'mapbox/streets-v11',
      tileSize: 512,
      zoomOffset: -1,
      accessToken: 'pk.eyJ1IjoieW94Y3UiLCJhIjoiY2s4c21scW8yMDB6MzNkbndlYXpraTEwdSJ9.VGfekLj7rTAtlifcuD4Buw'
  }).addTo(map);
  
  var map2 = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 21,
      id: 'mapbox/satellite-streets-v11',
      tileSize: 512,
      zoomOffset: -1,
      accessToken: 'pk.eyJ1IjoieW94Y3UiLCJhIjoiY2s4c21scW8yMDB6MzNkbndlYXpraTEwdSJ9.VGfekLj7rTAtlifcuD4Buw'
  }).addTo(map);
  L.control.layers({  
    "Satellite": map2,
    "Street": map1,
  }, null).addTo(map);

  var polyline = L.polyline(latlngs, {color: 'blue'}).addTo(map);
  // zoom the map to the polyline
  map.fitBounds(polyline.getBounds());

  map.on('mousemove', function(e){
    var closest_ind = find_closest_ind(e.latlng);
    update_map_popup(closest_ind);
    adjust_plot_pos(closest_ind);
  });
}

function update_map_popup(indx){
  if (indx != -1 && curr_map_indx != indx){
    var content= []
    for (var i in series_shown){
      if (series_shown[i]){
        content=content.concat([
          names[i],
          ": ",
          data[parseInt(i)+1][indx],
          units[i],
          "<br>"
        ]);
      }
    }
    content.pop()
    if (map_popup == null){
      map_popup = L.popup()
        .setLatLng(latlngs[indx])
        .setContent(content.join(""))
        .openOn(map);
    } else {
      map_popup.setLatLng(latlngs[indx])
      .setContent(content.join(""))
      .update()
    }
    curr_map_indx=indx;
  }
}

function adjust_plot_pos(indx){
  if (indx != -1 && curr_plot_indx != indx){
    var time = Times[indx];
    var curr_plot_indx = indx;
    var view_width=uplot.scales.x.max-uplot.scales.x.min;
    var new_min=time-view_width/2;
    var new_max=time+view_width/2;
    if (new_min < Times[0]){
      new_min=Times[0];
      new_max=new_min+view_width;
    }else if (new_max > Times[Times.length-1]) {
      new_max=Times[Times.length-1];
      new_min=new_max-view_width;
    }
    var new_cursor_left=(time-new_min)/(view_width)*uplot.bbox.width;
    uplot.setScale("x",{min:new_min,max:new_max});
    uplot.setCursor({left:new_cursor_left,top:0})
  }
}

function generate_series(){
  var series=[{}];
  for (i in names){
    var digit=2;
    switch (names[i]){
      case "DutyCycle":
      case "Altitude":
      case "Power":
        digit=0;
    }
    series.push({
      // initial toggled state (optional)
      show: true,
      spanGaps: true,
      // in-legend display
      label: names[i],
      value:  (function() {
        var j = i; // j is a copy of i only available to the scope of the inner function
        var digit_save=digit;
        return function(self,rawValue) {
          if (rawValue != null) {
            return rawValue.toFixed(digit_save) + units[j];
          }
        }
      })(),
      scale: units[i],

      // series style
      stroke: colors[i],
      width: 2,
      fill: fill[i],
      //dash: [10, 5],
    });
  }
  return series;
}

function generate_axes(show){
  var axes=[{}]
  for (i in axes_names){
    //1=right 3=left
    var side = (i%2)*2+1;
    axes.push(
      {
        show: show,
        scale: axes_names[i],
        values: (function() {
          var j = i; // j is a copy of i only available to the scope of the inner function
          return function(self,ticks) {
            return ticks.map(rawValue => rawValue + axes_names[j]);
          }
        })(),
        side: side,
        grid: {show: false},
      },
    )
  }
  return axes;
}

function generate_scales(){
  var scales={};
  for (var i in axes_names){
    var curr_min=99999
    var curr_max=-99999
    var indxs = getAllIndexes(units,axes_names[i])
    for (var j in indxs){
      curr_min=Math.min(curr_min,Math.min(...data[indxs[j]+1]))
      curr_max=Math.max(curr_max,Math.max(...data[indxs[j]+1]))
    }
    scales[axes_names[i]]={
      auto: false,
      range: [curr_min,curr_max],
    }
  }
  return scales;
}

function get_window_size() {
  var height = document.getElementById("chart").offsetHeight;
  var legend=document.getElementsByClassName("legend");
  if (legend.length >0){
    height=height-legend[0].offsetHeight;
  }else{
    height=height*0.8
  }
  return {
    width: document.getElementById("chart").offsetWidth,
    height: height,
  }
}

function create_chart(){
  var opts = {
    id: "plot",
    class: "chartclass",
    ...get_window_size(),
    plugins: [
      touchZoomPlugin()
    ],
    cursor: {
      y:false,
    },
    series: generate_series(),
    axes: generate_axes(false),
    scales: generate_scales(),
  };

  uplot = new uPlot(opts, data, document.getElementById("chart"));
  document.getElementById("chart").addEventListener("mousemove", e => {
    if (uplot.cursor.idx != null && curr_plot_indx != uplot.cursor.idx){
      curr_plot_indx=uplot.cursor.idx;
      update_map_popup(curr_plot_indx);
    }
  });
  uplot.setSize(get_window_size());
}

function parse_LogFile(txt){
  var logEntries = {};
  var lines = txt.split("\n");
  names="Voltage, Motor Temp, Mosfet Temp, DutyCycle, Motor Current, Battery Current, eRPM, eDistance, Altitude, Speed".split(",");
  for (var i in lines) {
    // Skip empty lines
    if (lines[i]==""){
      continue;
    }

    // Split CSV
    var values = lines[i].split(",");

    // Create array item if necessary
    if(logEntries[values[0]] == null) {
      logEntries[values[0]] = {vin: null, tempMotor: null, tempESC: null, dutyCycle: null, currentMotor: null, currentBattery: null, speed: null, distance: null, lat: null, lon: null, altitude: null, speedGPS: null, satellites: null};
    }

    if (values[1] == "values") {
      var this_esc_id = Number(values[10]);
      if (first_esc_id == null) {
        first_esc_id = this_esc_id;
      }
      if (this_esc_id == first_esc_id)
      {
        logEntries[values[0]]['vin'] = Number(values[2]);
        logEntries[values[0]]['tempMotor'] = Number(values[3]);
        logEntries[values[0]]['tempESC'] = Number(values[4]);
        logEntries[values[0]]['dutyCycle'] = Number(values[5]);
        logEntries[values[0]]['currentMotor'] = Number(values[6]);
        logEntries[values[0]]['currentBattery'] = Number(values[7]);
        logEntries[values[0]]['speed'] = Number(values[8]);
        logEntries[values[0]]['distance'] = Number(values[9]);
      }
      else
      {
        //TODO: multiple ESC mode
        multi_esc_mode = true;
      }
    } else if (values[1] == "position") {
      logEntries[values[0]]['lat'] = Number(values[2]);
      logEntries[values[0]]['lon'] = Number(values[3]);
      logEntries[values[0]]['satellites'] = Number(values[4]);
      logEntries[values[0]]['altitude'] = Number(values[5]);
      logEntries[values[0]]['speedGPS'] = Number(values[6]);
    }else{
      console.log("unepxected data:\n"+lines[i])
    }
  } // i in lines

  // Prepare for uPlot
  for (const [key, value] of Object.entries(logEntries)) {
    Times.push((new Date([key,"Z"].join(""))).getTime()/1000);
    InpVoltages.push(value.vin);
    TempMotors.push(value.tempMotor);
    TempPcbs.push(value.tempESC);
    DutyCycles.push(value.dutyCycle);
    MotorCurrents.push(value.currentMotor);
    BatteryCurrents.push(value.currentBattery);
    Speeds.push(value.speed);
    Distances.push(value.distance);
    latlngs.push([value.lat, value.lon]);
    Altitudes.push(value.altitude);
    GPSSpeeds.push(value.speedGPS);
  }
}

function append_file_content(files_arr){
  var done=true;
  for (var i in files_arr){
    if (files_arr[i].reader.readyState != 2){
      console.log("not fin");
      done=false;
      break;
    }
  }
  if (done){
    files_arr.sort(compare_filetimes);
    for (i in files_arr){
      parse_LogFile(files_arr[i].reader.result)
    }
    //Voltage, Motor Temp, Mosfet Temp, DutyCycle, Motor Current, Battery Current, eRPM, eDistance, ESC ID
    data = [Times,InpVoltages,TempMotors,TempPcbs,DutyCycles,MotorCurrents,BatteryCurrents,Speeds,Distances,Altitudes,GPSSpeeds]
    create_map();
    create_chart();
    fill_menu();
    show_content();
  }
}

var files;
function handleFileSelect(evt) {
  show_loader();
  files = evt.target.files; // FileList object
  var files_arr=[]
  // files is a FileList of File objects. List some properties.
  var output = [];
  for (var i = 0, f; f = files[i]; i++) {
    output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
                f.size, ' bytes', '</li>');

    // Only process text files
    console.log("file type: " + f.type);
    if (!f.type.match('text.*')) {
      //TODO: why is this not working for andrew
      //handleError("Error Selecting File: Not a text/csv File")
      //continue;
    }


    var name_parts=f.name.split("_");
    var time=(new Date([name_parts[0],"T",name_parts[1].replace(/-/g,":"),"Z"].join("")));

    var reader = new FileReader();
    // Closure to capture the file information.
    reader.onload = function(e) {
        append_file_content(files_arr); //todo append
        //parse_LogFile(e.target.result);
      };

    // Read in the file
    reader.readAsText(f);
    files_arr.push({time: time,reader: reader});
  }
  //document.getElementById('file_list').innerHTML = '<ul>' + output.join('') +'</ul>';
}

if (window.location.search.length >1){
  var args=window.location.search.substr(1).split("&");
  for (i in args){
    var arg=args[i].split("=");
    switch (arg[0]){
      case "log":
        get_Log(arg[1]);
        break;
      default:
        show_upload();
    }
  }
}else{
  show_upload();
}
document.getElementById('files').addEventListener('change', handleFileSelect, false);
window.addEventListener("resize", throttle(() => uplot.setSize(get_window_size()), 100));
