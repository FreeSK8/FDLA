var debug;

//create trigger to resizeEnd event     
$(window).resize(function() {
    if(this.resizeTO) clearTimeout(this.resizeTO);
    this.resizeTO = setTimeout(function() {
        $(this).trigger('resizeEnd');
    }, 500);
});

//redraw graph when window resize is completed  
$(window).on('resizeEnd', function() {
    drawChart();
});

// Google Chart Colors
var defaultColors = ['#3366cc',
'#dc3912',
'#ff9900',
'#109618',
'#990099',
'#0099c6',
'#dd4477',
'#66aa00',
'#b82e2e',
'#316395',
'#994499',
'#22aa99',
'#aaaa11',
'#6633cc',
'#e67300',
'#8b0707',
'#651067',
'#329262',
'#5574a6',
'#3b3eac',
'#b77322',
'#16d620',
'#b91383',
'#f4359e',
'#9c5935',
'#a9c413',
'#2a778d',
'#668d1c',
'#bea413',
'#0c5922',
'#743411'];

//Chart
var chart;
var gChartData = [];
var gDataTable;

//Chart toggle series
var dataView;
var gChartColumns = [];
var nullFunc = function() {return 0;};

//Map
var map;
var rideCoordinates = [];
var infowindowChartSelection;
var infowindowRouteHover;
var markerChartSelection;
var markerChartHover;

//Old
var menu_visible=false;
var map_popup;

//Parsing
var parsedLogEntries = [];
var first_esc_id = null;
var multi_esc_mode = false;
var quad_esc_mode = false;
var esc_ids = [];

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


function zoomToObject(obj){
    var bounds = new google.maps.LatLngBounds();
    var points = obj.getPath().getArray();
    for (var n = 0; n < points.length ; n++){
        bounds.extend(points[n]);
    }
    map.fitBounds(bounds);
}

function create_map(){

  map = new google.maps.Map(document.getElementById("mapid"), {
          center: {
            lat: 37.772,
            lng: -122.214,
          },
          zoom: 8,
        });

  infowindowRouteHover = new google.maps.InfoWindow({
              content: "",
            });

  const routePath = new google.maps.Polyline({
    path: rideCoordinates,
    geodesic: true,
    strokeColor: "#FF00FF",
    strokeOpacity: 1.0,
    strokeWeight: 4,
  });
  routePath.setMap(map);
  google.maps.event.addListener(routePath, 'click', function() {
    debug = routePath;
    console.log(routePath);
    // TODO: idk yet
  });
  // Route Hover InfoWindow
  google.maps.event.addListener(routePath, 'mouseover', function(e) {
    debug = e;
    infowindowRouteHover.setPosition(e.latLng);
    infowindowRouteHover.setContent("You are at " + e.latLng);
    infowindowRouteHover.open(map);
  });
  // Route Hover InfoWindow
  google.maps.event.addListener(routePath, 'mouseout', function() {
      infowindowRouteHover.close();
  });

  zoomToObject(routePath);
}

function create_chart(){
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(drawChart);
}

function selectHandler() {
        var selectedItem = chart.getSelection()[0];
        var value = gDataTable.getValue(selectedItem.row, 0);
        console.log('The user selected ' + value);

        console.log(parsedLogEntries[value]);
        try {
          map.setCenter({lat: parsedLogEntries[value].lat, lng: parsedLogEntries[value].lon});
          map.setZoom(20);

          var data = parsedLogEntries[value];
          var infoWindowString = `Selected Moment
          <br/>VIN: ${data.vin}
          <br/>tempMotor: ${data.tempMotor}
          <br/>tempESC: ${data.tempESC}
          <br/>dutyCycle: ${data.dutyCycle}
          <br/>currentMotor: ${data.currentMotor}
          <br/>currentBattery: ${data.currentBattery}
          <br/>altitude: ${data.altitude}
          <br/>speedGPS: ${data.speedGPS}
          <br/>eRPM: ${data.eRPM}
          <br/>eDistance: ${data.eDistance}
          <br/>distance_km: ${data.distance}
          <br/>speed_kph: ${data.speed}`;
          if (markerChartSelection == null) {
            infowindowChartSelection = new google.maps.InfoWindow({
              content: infoWindowString,
            });
            markerChartSelection = new google.maps.Marker({
              position: {lat: parsedLogEntries[value].lat, lng: parsedLogEntries[value].lon},
              map,
              title: "Curent Location",
            });
            markerChartSelection.addListener("click", () => {
              infowindowChartSelection.open(map, markerChartSelection);
            });
            infowindowChartSelection.open(map, markerChartSelection);
          } else {
            infowindowChartSelection.setContent(infoWindowString);
            markerChartSelection.setPosition({lat: parsedLogEntries[value].lat, lng: parsedLogEntries[value].lon});
            infowindowChartSelection.open(map, markerChartSelection);
          }
          
        } catch (e) {
          console.log(e);
        }
      }

function drawChart() {
  if (!chart) {
    gDataTable = google.visualization.arrayToDataTable(gChartData);
    dataView = new google.visualization.DataView(gDataTable);

    chart = new google.visualization.LineChart(document.getElementById('curve_chart'));

    // Toggle visibility of data series on click of legend.
    google.visualization.events.addListener(chart, 'click', function (target) {
      if (target.targetID.match(/^legendentry#\d+$/)) {    
        var index = parseInt(target.targetID.slice(12)) + 1;
        console.log(index);
        gChartColumns[index].visible = !gChartColumns[index].visible;
        console.log("test");
        drawChart();
        console.log("test2");
      }
    });

    google.visualization.events.addListener(chart, 'select', selectHandler);

    // add a mouseover event handler to highlight the bar
    google.visualization.events.addListener(chart, 'onmouseover', function (e) {
      //console.log("on mouse over");
      try {
        debug = e;
        if (e.row == null) return;
        var value = gDataTable.getValue(e.row, 0);

        if (markerChartHover == null) {
          
          markerChartHover = new google.maps.Marker({
            position: {lat: parsedLogEntries[value].lat, lng: parsedLogEntries[value].lon},
            map,
            title: "Curent Location",
          });
        } else {
          markerChartHover.setPosition({lat: parsedLogEntries[value].lat, lng: parsedLogEntries[value].lon});
        }

        map.setCenter({lat: parsedLogEntries[value].lat, lng: parsedLogEntries[value].lon});
      } catch (e) {
        console.log(e);
      }
    });
    
    // add a mouseout event handler to clear highlighting
    google.visualization.events.addListener(chart, 'onmouseout', function () {
        //console.log("on mouse out");
    });
  }
  

  var options = {
    //title: 'ESK8 Data',
    backgroundColor: '#27262b', //'#d0cdc9'
    lineWidth: 3,
    chartArea: {'width': '100%', 'height': '80%'},
    curveType: 'function',
    legend: { 
      position: 'top',
      maxLines: 3, 
      textStyle: {
        color: '#e6e1e8'
      }
    },
    vAxis: {
        title: '',
        viewWindowMode: 'explicit',
        //viewWindow: {
            //max: 180,
            //min: 0,
            //interval: 1,
        //},
    },
    hAxis: {
      viewWindow:{
          interval: 10,
      },
      gridlines: {
        color: '#353535'
      }
    },
    explorer: { 
      actions: ['dragToZoom', 'rightClickToReset'],
      axis: 'horizontal',
      keepInBounds: true,
      maxZoomIn: 4.0
    },
    focusTarget: 'category'
  };

  

  // Set series visibility
  var visibleColumnIndexes = [0];
  var colors = [];

  for (var i = 1; i < gChartColumns.length; i++) {
    if (gChartColumns[i].visible) {
      colors.push(gChartColumns[i].color);

      visibleColumnIndexes.push(i);
    }
    else {
      colors.push("#4c4c4c");

      visibleColumnIndexes.push({
        calc: nullFunc,
        type: gChartColumns[i].type,
        label: gChartColumns[i].label,
      });
    }
  };
  dataView.setColumns(visibleColumnIndexes);
  options.colors = colors;
  chart.draw(dataView, options);
}

function parse_LogFile(txt){
  var logEntries = [];
  var lines = txt.split("\n");
  names="Voltage, Motor Temp, Mosfet Temp, DutyCycle, Motor Current, Battery Current, eRPM, eDistance, Altitude, Speed".split(",");
  for (var i in lines) {
    // Skip empty lines
    if (lines[i]==""){
      continue;
    }

    try {
      // Split CSV
      var values = lines[i].split(",");

      // Create array item if necessary
      if(logEntries[values[0]] == null) {
        logEntries[values[0]] = {
          vin: null,
          tempMotor: null,
          tempMotor2: null,
          tempMotor3: null,
          tempMotor4: null,
          tempESC: null,
          tempESC2: null,
          tempESC3: null,
          tempESC4: null,
          dutyCycle: null,
          currentMotor: null,
          currentMotor2: null,
          currentMotor3: null,
          currentMotor4: null,
          currentBattery: null,
          speed: null,
          eRPM: null,
          distance: null,
          eDistance: null,
          lat: null,
          lon: null,
          altitude: null,
          speedGPS: null,
          satellites: null,
          fault: null
        };
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
          logEntries[values[0]]['eRPM'] = Number(values[8]);
          logEntries[values[0]]['eDistance'] = Number(values[9]);
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
      } else if (values[1] == "gps") {
        //dt,gps,satellites,altitude,speed,latitude,longitude
        logEntries[values[0]]['lat'] = Number(values[5]);
        logEntries[values[0]]['lon'] = Number(values[6]);
        logEntries[values[0]]['satellites'] = Number(values[2]);
        logEntries[values[0]]['altitude'] = Number(values[3]);
        logEntries[values[0]]['speedGPS'] = Math.abs(Number(values[4])); //TODO: abs is a patch
      } else if (values[1] == "esc") {
        //0 ,1  ,2     ,3      ,4         ,5       ,6         ,7            ,8              ,9         ,10              ,11   ,12        ,13   ,14       ,15
        //dt,esc,esc_id,voltage,motor_temp,esc_temp,duty_cycle,motor_current,battery_current,watt_hours,watt_hours_regen,e_rpm,e_distance,fault,speed_kph,distance_km

        var this_esc_id = Number(values[2]);
        if (first_esc_id == null) {
          first_esc_id = this_esc_id;
          esc_ids.push(this_esc_id);
        }
        if (this_esc_id == first_esc_id)
        {
          logEntries[values[0]]['vin'] = Number(values[3]);
          logEntries[values[0]]['tempMotor'] = Number(values[4]);
          logEntries[values[0]]['tempESC'] = Number(values[5]);
          logEntries[values[0]]['dutyCycle'] = Number(values[6]);
          logEntries[values[0]]['currentMotor'] = Number(values[7]);
          logEntries[values[0]]['currentBattery'] = Number(values[8]);
          logEntries[values[0]]['eRPM'] = Number(values[11]);
          logEntries[values[0]]['eDistance'] = Number(values[12]);
          logEntries[values[0]]['fault'] = Number(values[13]);
          logEntries[values[0]]['speed'] = Number(values[14]);
          logEntries[values[0]]['distance'] = Number(values[15]);
        }
        else
        {
          //TODO: multiple ESC mode
          multi_esc_mode = true;

          if (!esc_ids.includes(this_esc_id)) 
          {
            console.log("adding multi esc id");
            esc_ids.push(this_esc_id);
          }

          switch(esc_ids.indexOf(this_esc_id))
          {
            case 0:
              console.log("Error: ESC ID is first in array");
            break;
            case 1:
              logEntries[values[0]]['tempMotor2'] = Number(values[4]);
              logEntries[values[0]]['tempESC2'] = Number(values[5]);
              logEntries[values[0]]['currentMotor2'] = Number(values[7]);
            break;
            case 2:
              logEntries[values[0]]['tempMotor2'] = Number(values[4]);
              logEntries[values[0]]['tempESC2'] = Number(values[5]);
              logEntries[values[0]]['currentMotor2'] = Number(values[7]);
            break;
            case 3:
              quad_esc_mode = true;
              logEntries[values[0]]['tempMotor2'] = Number(values[4]);
              logEntries[values[0]]['tempESC2'] = Number(values[5]);
              logEntries[values[0]]['currentMotor2'] = Number(values[7]);
            break;
            default:
              console.log("Error: Too many ESC IDs in data set");
          }
        }
      } else {
        console.log("unepxected data:\n"+lines[i])
      }
    } catch (e) {
      console.log("parse_LogFile: exception");
      console.log(e);
    }
  } // i in lines

  // Prepare for gChart
  if (multi_esc_mode && quad_esc_mode)
  {
    gChartData = [['datetime',
        'vin',
        'tempMotor',
        'tempMotor2',
        'tempMotor3',
        'tempMotor4',
        'tempESC',
        'tempESC2',
        'tempESC3',
        'tempESC4',
        'dutyCycle',
        'currentMotor',
        'currentMotor2',
        'currentMotor3',
        'currentMotor4',
        'currentBattery',
        'altitude',
        'speedGPS']];
    gChartColumns = [
      {
        type: 'number',
        label: 'datetime'
      },
      {
        type: 'number',
        label: 'vin',
        color: defaultColors[0],
        visible: true
      },
      {
        type: 'number',
        label: 'tempMotor',
        color: defaultColors[1],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempMotor2',
        color: defaultColors[2],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempMotor3',
        color: defaultColors[3],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempMotor4',
        color: defaultColors[4],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC',
        color: defaultColors[5],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC2',
        color: defaultColors[6],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC3',
        color: defaultColors[7],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC4',
        color: defaultColors[8],
        visible: true,
      },
      {
        type: 'number',
        label: 'dutyCycle',
        color: defaultColors[9],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor',
        color: defaultColors[10],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor2',
        color: defaultColors[11],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor3',
        color: defaultColors[12],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor4',
        color: defaultColors[13],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentBattery',
        color: defaultColors[14],
        visible: true,
      },
      {
        type: 'number',
        label: 'altitude',
        color: defaultColors[15],
        visible: true,
      },
      {
        type: 'number',
        label: 'speedGPS',
        color: defaultColors[16],
        visible: true,
      }
    ];
  }
  else if (multi_esc_mode)
  {
    gChartData = [['datetime',
        'vin',
        'tempMotor',
        'tempMotor2',
        'tempESC',
        'tempESC2',
        'dutyCycle',
        'currentMotor',
        'currentMotor2',
        'currentBattery',
        'altitude',
        'speedGPS']];
    gChartColumns = [
      {
        type: 'number',
        label: 'datetime'
      },
      {
        type: 'number',
        label: 'vin',
        color: defaultColors[0],
        visible: true
      },
      {
        type: 'number',
        label: 'tempMotor',
        color: defaultColors[1],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempMotor2',
        color: defaultColors[2],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC',
        color: defaultColors[3],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC2',
        color: defaultColors[4],
        visible: true,
      },
      {
        type: 'number',
        label: 'dutyCycle',
        color: defaultColors[5],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor',
        color: defaultColors[6],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor2',
        color: defaultColors[7],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentBattery',
        color: defaultColors[8],
        visible: true,
      },
      {
        type: 'number',
        label: 'altitude',
        color: defaultColors[9],
        visible: true,
      },
      {
        type: 'number',
        label: 'speedGPS',
        color: defaultColors[10],
        visible: true,
      }
    ];
  }
  else
  {
    gChartData = [['datetime',
        'vin',
        'tempMotor',
        'tempESC',
        'dutyCycle',
        'currentMotor',
        'currentBattery',
        'altitude',
        'speedGPS']];
    gChartColumns = [
      {
        type: 'number',
        label: 'datetime'
      },
      {
        type: 'number',
        label: 'vin',
        color: defaultColors[0],
        visible: true
      },
      {
        type: 'number',
        label: 'tempMotor',
        color: defaultColors[1],
        visible: true,
      },
      {
        type: 'number',
        label: 'tempESC',
        color: defaultColors[2],
        visible: true,
      },
      {
        type: 'number',
        label: 'dutyCycle',
        color: defaultColors[3],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentMotor',
        color: defaultColors[4],
        visible: true,
      },
      {
        type: 'number',
        label: 'currentBattery',
        color: defaultColors[5],
        visible: true,
      },
      {
        type: 'number',
        label: 'altitude',
        color: defaultColors[6],
        visible: true,
      },
      {
        type: 'number',
        label: 'speedGPS',
        color: defaultColors[7],
        visible: true,
      }
    ];
  }

  // Iterate parsed log
  for (const [key, value] of Object.entries(logEntries)) {
    if(value.vin != null) {
      parsedLogEntries[new Date(key)] = value;

      if (multi_esc_mode && quad_esc_mode) {
        gChartData.push([
          new Date(key),
          value.vin,
          value.tempMotor,
          value.tempMotor2,
          value.tempMotor3,
          value.tempESC,
          value.tempESC2,
          value.tempESC3,
          value.dutyCycle,
          value.currentMotor,
          value.currentMotor2,
          value.currentMotor3,
          value.currentBattery,
          value.altitude,
          value.speedGPS]
        );
      } else if (multi_esc_mode) {
        gChartData.push([
          new Date(key),
          value.vin,
          value.tempMotor,
          value.tempMotor2,
          value.tempESC,
          value.tempESC2,
          value.dutyCycle,
          value.currentMotor,
          value.currentMotor2,
          value.currentBattery,
          value.altitude,
          value.speedGPS]
        );
      } else {
        gChartData.push([
          new Date(key),
          value.vin,
          value.tempMotor,
          value.tempESC,
          value.dutyCycle,
          value.currentMotor,
          value.currentBattery,
          value.altitude,
          value.speedGPS]
        );
      }

      if (value.lat != null) {
        rideCoordinates.push({ lat: value.lat, lng: value.lon });
      }
      
    }
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
    try {
      esc_ids = [];
      gChartData = [];
      rideCoordinates = [];

      files_arr.sort(compare_filetimes);
      for (i in files_arr){
        console.log("hi");
        parse_LogFile(files_arr[i].reader.result);
        console.log("bye");
      }

      create_map();
      create_chart();
      show_content();
    } catch (e) {
      alert("Buggy bug bug. Something is unhappy: " + e);
      show_upload();
    }
  }
}

var files;
function handleFileSelect(evt) {
  try {
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

      var time = Date.parse(f.name);

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
  } catch (e) {
    alert("Buggy bug bug. Something is unhappy: " + e);
    show_upload();
  }
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

