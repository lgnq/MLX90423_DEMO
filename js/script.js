// let the editor know that `Chart` is defined by some code
// included in another file (in this case, `index.html`)
// Note: the code will still work without this line, but without it you
// will see an error in the editor
/* global THREE */
/* global TransformStream */
/* global TextEncoderStream */
/* global TextDecoderStream */
'use strict';

// import * as THREE from 'three';
// import {OBJLoader} from 'objloader';

let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

let orientations = [0, 0, 0];

let plots = [];

let x = 0;
let y = 0;
let z = 0;
let s = 0;

let prefix;
let separator;

let size;

const maxLogLength  = 50;
const baudRates     = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];

const log           = document.getElementById('log');
const butConnect    = document.getElementById('butConnect');
const butClear      = document.getElementById('butClear');
const baudRate      = document.getElementById('baudRate');
const autoscroll    = document.getElementById('autoscroll');
const showTimestamp = document.getElementById('showTimestamp');
const kalmanFilter  = document.getElementById('kalmanfilter');
const lightSS       = document.getElementById('light');
const darkSS        = document.getElementById('dark');
const darkMode      = document.getElementById('darkmode');
const logContainer  = document.getElementById("log-container");
const myInput       = document.getElementById('myInput');
const sampleSize    = document.getElementById('sampleSize');

let config = {responsive: true}

let layout_xyz = {
  autosize: true,
  // margin: { t: 5, b: 5, l: 5, r: 5 },

  title: 'MLX90423 Output(PWM)',
  
  xaxis: {
    title: 'time',
    showgrid: false,
    zeroline: false
  },

  yaxis: {
    title: 'Duty Cycle(%)',
    showline: false
  }  
};

let trace_x = {
  // type: 'line',
  // type: 'scattergl',
  // x: [0],
  y: [0],
  mode: 'lines',
  name: 'Sensor 1',
  // fill: 'tozeroy',
  line: {
    color: 'rgb(0, 53, 75)',
    width: 1
  }
};

let trace_y = {
  // type: 'line',
  // type: 'scattergl',
  // x: [0],
  y: [0],
  mode: 'lines',
  name: 'Sensor 2',
  line: {
    color: 'rgb(101, 187, 169)',
    width: 1
  }
};

let trace_z = {
  // type: 'line',
  // type: 'scattergl',
  // x: [0],
  y: [0],
  mode: 'lines',
  name: 'Sensor 3',
  line: {
    color: 'rgb(219, 65, 64)',
    width: 1
  }
};

let trace_s = {
  // type: 'line',
  // type: 'scattergl',
  // x: [0],
  y: [0],
  mode: 'lines',
  name: 'Sensor 4',
  line: {
    color: 'rgb(238, 163, 32)',
    width: 1
  }
};

let data_xyz = [trace_x, trace_y, trace_z, trace_s];

document.addEventListener('DOMContentLoaded', async () => {
  butConnect.addEventListener('click', clickConnect);
  butClear.addEventListener('click', clickClear);
  autoscroll.addEventListener('click', clickAutoscroll);
  showTimestamp.addEventListener('click', clickTimestamp);
  kalmanFilter.addEventListener('click', clickKalmanfilter);
  baudRate.addEventListener('change', changeBaudRate);
  darkMode.addEventListener('click', clickDarkMode);
  myInput.addEventListener('keydown', writeCmd);
  sampleSize.addEventListener('keydown', setSampleSize);

  size = parseInt(sampleSize.value);

  if ('serial' in navigator) {
    const notSupported = document.getElementById('notSupported');
    notSupported.classList.add('hidden');
  }

  Plotly.newPlot('plot1', data_xyz, layout_xyz, config);
  plots.push('plot1');

  initBaudRate();
  loadAllSettings();
  updateTheme();
});

/**
 * @name connect
 * Opens a Web Serial connection to a micro:bit and sets up the input and
 * output stream.
 */
async function connect() {
  // - Request a port and open a connection.
  port = await navigator.serial.requestPort();

  // - Wait for the port to open.toggleUIConnected
  await port.open({ baudRate: baudRate.value });

  let decoder = new TextDecoderStream();
  inputDone   = port.readable.pipeTo(decoder.writable);
  inputStream = decoder.readable.pipeThrough(new TransformStream(new LineBreakTransformer()));

  const encoder = new TextEncoderStream();
  outputDone    = encoder.readable.pipeTo(port.writable);
  outputStream  = encoder.writable;

  reader = inputStream.getReader();

  prefix    = document.getElementById('messageprefixid').value
  separator = document.getElementById('messageseparatorid').value

  readLoop().catch(async function(error) {
    toggleUIConnected(false);
    await disconnect();
  });
}

/**
 * @name disconnect
 * Closes the Web Serial connection.
 */
async function disconnect() {
  if (reader) {
    await reader.cancel();
    await inputDone.catch(() => {});
    reader = null;
    inputDone = null;
  }

  if (outputStream) {
    await outputStream.getWriter().close();
    await outputDone;
    outputStream = null;
    outputDone = null;
  }

  await port.close();
  port = null;
}

/**
 * @name readLoop
 * Reads data from the input stream and displays it on screen.
 */
async function readLoop() {
  while (true) {
    const {value, done} = await reader.read();

    if (value) {
      if (value.substr(0, prefix.length) == prefix) {
        orientations = value.substr(prefix.length).trim().split(separator).map(x=>+x);
      }
    }

    x = orientations[0];
    y = orientations[1];
    z = orientations[2];
    s = orientations[3];

    for (let i = 0; i < plots.length; i++)
    {
      Plotly.extendTraces(plots[i], {y:[[x], [y], [z], [s]]}, [0, 1, 2, 3], size);
    }

    if (trace_x.y.length > size)
      trace_x.y.pop();
    if (trace_y.y.length > size)
      trace_y.y.pop();
    if (trace_z.y.length > size)
      trace_z.y.pop();
    if (trace_s.y.length > size)
      trace_s.y.pop();

    // Plotly.update('linear_chart', {value: orientations[0].toFixed(3)}, {}, [0]);
    Plotly.update('linear_chart', {value: [orientations[0].toFixed(3), orientations[1].toFixed(3), orientations[2].toFixed(3), orientations[3].toFixed(3)]}, {}, [0, 1, 2, 3]);
    // Plotly.update('linear_chart', {gauge: {steps: {range: [x, x+50]}}}, [0]);

    if (done) {
      console.log('[readLoop] DONE', done);
      reader.releaseLock();
      break;
    }
  }
}

function logData(line) {
  if (kalmanFilter.checked)
  {
    console.log('kalman filter is enabled');
  }

  // Update the Log
  if (showTimestamp.checked) {
    let d = new Date();
    let timestamp = d.getHours() + ":" + `${d.getMinutes()}`.padStart(2, 0) + ":" +
        `${d.getSeconds()}`.padStart(2, 0) + "." + `${d.getMilliseconds()}`.padStart(3, 0);

    log.innerHTML += '<span class="timestamp">' + timestamp + ' -> </span>';
    
    // Plotly.extendTraces('plot1', {x:[[d.getMilliseconds()], [d.getMilliseconds()], [d.getMilliseconds()]], y:[[orientations[0]], [orientations[1]], [orientations[2]]]}, [0, 1, 2], 300);
    
    d = null;
  }

  log.innerHTML += line+ "<br>";

  // Remove old log content
  if (log.textContent.split("\n").length > maxLogLength + 1) {
    let logLines = log.innerHTML.replace(/(\n)/gm, "").split("<br>");
    
    log.innerHTML = logLines.splice(-maxLogLength).join("<br>\n");
  }

  if (autoscroll.checked) {
    log.scrollTop = log.scrollHeight
  }
}

/**
 * @name updateTheme
 * Sets the theme to  Adafruit (dark) mode. Can be refactored later for more themes
 */
function updateTheme() {
  // Disable all themes
  document.querySelectorAll('link[rel=stylesheet].alternate').forEach((styleSheet) => {
      enableStyleSheet(styleSheet, false);
    });

  if (darkMode.checked) {
    enableStyleSheet(darkSS, true);
  } 
  else {
    enableStyleSheet(lightSS, true);
  }
}

function enableStyleSheet(node, enabled) {
  node.disabled = !enabled;
}

/**
 * @name reset
 * Reset the Plotter, Log, and associated data
 */
async function reset() {
  // Clear the data
  log.innerHTML = "";
}

/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 */
async function clickConnect() {
  if (port) {
    await disconnect();
    toggleUIConnected(false);
    return;
  }

  await connect();

  reset();

  toggleUIConnected(true);
}

/**
 * @name clickAutoscroll
 * Change handler for the Autoscroll checkbox.
 */
async function clickAutoscroll() {
  saveSetting('autoscroll', autoscroll.checked);
}

/**
 * @name clickTimestamp
 * Change handler for the Show Timestamp checkbox.
 */
async function clickTimestamp() {
  saveSetting('timestamp', showTimestamp.checked);
}

/**
 * @name clickTimestamp
 * Change handler for the Show Timestamp checkbox.
 */
async function clickKalmanfilter() {
  saveSetting('kalmanfilter', kalmanFilter.checked);
}

/**
 * @name changeBaudRate
 * Change handler for the Baud Rate selector.
 */
async function changeBaudRate() {
  saveSetting('baudrate', baudRate.value);
}

/**
 * @name clickDarkMode
 * Change handler for the Dark Mode checkbox.
 */
async function clickDarkMode() {
  updateTheme();
  saveSetting('darkmode', darkMode.checked);
}

/**
 * @name clickClear
 * Click handler for the clear button.
 */
async function clickClear() {
  reset();
}

async function finishDrawing() {
  return new Promise(requestAnimationFrame);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @name writeCmd
 * Gets a writer from the output stream and send the command to the Smart USB Dongle 2.0.
 * @param  {string} cmd command to send to the Smart USB Dongle 2.0
 */
function writeCmd(event) {
  // Write to output stream
  const writer = outputStream.getWriter();

  if (event.keyCode === 13) {
    console.log(myInput.value);
    
    writer.write(myInput.value + '\r');
    myInput.value = ''
  }

  // Ignores sending carriage return if sending Ctrl+C
  // if (cmd !== "\x03") {
    // writer.write("\r"); // Important to send a carriage return after a command
  // }
  
  writer.releaseLock();
}

function setSampleSize(event) {
  if (event.keyCode === 13) {
    console.log(sampleSize.value);
    
    size = parseInt(sampleSize.value);
  }
}

/**
 * @name LineBreakTransformer
 * TransformStream to parse the stream into lines.
 */
class LineBreakTransformer {
  constructor() {
    // A container for holding stream data until a new line.
    this.container = '';
  }

  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split('\n');
    this.container = lines.pop();
    lines.forEach(line => {
      controller.enqueue(line)
      logData(line);
    });
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

function toggleUIConnected(connected) {
  let lbl = 'Connect';

  if (connected) {
    lbl = 'Disconnect';
  }

  butConnect.textContent = lbl;
  
  updateTheme()
}

function initBaudRate() {
  for (let rate of baudRates) {
    var option = document.createElement("option");
    option.text = rate + " Baud";
    option.value = rate;
    baudRate.add(option);
  }
}

function loadAllSettings() {
  // Load all saved settings or defaults
  autoscroll.checked    = loadSetting('autoscroll', true);
  showTimestamp.checked = loadSetting('timestamp', false);
  kalmanFilter.checked  = loadSetting('kalmanfilter', false);
  baudRate.value        = loadSetting('baudrate', 9600);
  darkMode.checked      = loadSetting('darkmode', false);
}

function loadSetting(setting, defaultValue) {
  let value = JSON.parse(window.localStorage.getItem(setting));

  if (value == null) {
    return defaultValue;
  }

  return value;
}

function saveSetting(setting, value) {
  window.localStorage.setItem(setting, JSON.stringify(value));
}

var w = parent.innerWidth;

let data = [
  {
    type: "indicator",
    mode: "number+gauge",
    value: 0.00,
    valueformat:'f',
    delta: { reference: 200 },
    domain: { x: [0.25, 1], y: [0, 0.1] },
    title: { text: "Sensor 1" },
    gauge: {
      shape: "bullet",
      axis: { range: [-300, 300] },
      // threshold: {
      //   line: { color: "red", width: 3 },
      //   thickness: 0.75,
      //   value: 50
      // },
      steps: [
        // { range: [-300, 0], color: "gray" },
        { range: [-300, 300], color: "lightgray"}
      ],
      bar: { color: "#00354B", thickness: 0.8 }
    }
  },
  {
    type: "indicator",
    mode: "number+gauge",
    value: 0.00,
    valueformat:'f',
    delta: { reference: 200 },
    domain: { x: [0.25, 1], y: [0.3, 0.4] },
    title: { text: "Sensor 2" },
    gauge: {
      shape: "bullet",
      axis: { range: [-300, 300] },
      // threshold: {
      //   line: { color: "black", width: 2 },
      //   thickness: 0.75,
      //   value: 50
      // },
      steps: [
        // { range: [-300, 0], color: "gray" },
        { range: [-300, 300], color: "lightgray" }
      ],
      bar: { color: "#65BBA9", thickness: 0.8 }
    }
  },
  {
    type: "indicator",
    mode: "number+gauge",
    value: 0.00,
    number: {'prefix': "XX", "valueformat": ".00f"},
    delta: { reference: 200 },
    domain: { x: [0.25, 1], y: [0.6, 0.7] },
    title: { text: "Sensor 3" },
    gauge: {
      shape: "bullet",
      axis: { range: [-300, 300] },
      // threshold: {
      //   line: { color: "black", width: 2 },
      //   thickness: 0.75,
      //   value: 210
      // },
      steps: [
        // { range: [-300, 0], color: "gray" },
        { range: [-300, 300], color: "lightgray" }
      ],
      bar: { color: "#DB4140", thickness: 0.8 }
    }
  },
  {
    type: "indicator",
    mode: "number+gauge",
    value: 0.00,
    number: {'prefix': "XX", "valueformat": ".00f"},
    delta: { reference: 200 },
    domain: { x: [0.25, 1], y: [0.9, 1] },
    title: { text: "Sensor 4" },
    gauge: {
      shape: "bullet",
      axis: { range: [-300, 300] },
      // threshold: {
      //   line: { color: "black", width: 2 },
      //   thickness: 0.75,
      //   value: 210
      // },
      steps: [
        // { range: [-300, 0], color: "gray" },
        { range: [-300, 300], color: "lightgray" }
      ],
      bar: { color: "#EEA320", thickness: 0.8 }
    }
  }  
];

var layout = {
  title: "linear travel detected by MLX90423(mm)",
  // width: w-200, height: 400,
  // margin: { t: 10, r: 20, l: 20, b: 0 }
};

Plotly.newPlot('linear_chart', data, layout, config);