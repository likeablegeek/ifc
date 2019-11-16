/*

ifc: A Node JS module providing a client the Infinite Flight Connect API.

Version: 1.1.2
Author: @likeablegeek

This version is based on previous versions by @nicolasbd and @Velocity23 and
and contains portions of their work.

Copyright 2019.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

var isIp = require('is-ip'); // Used to test if broadcast IP addresses are IPv6 vs IPv4
var dgram = require('dgram'); // For listening for UDP broadcasts
var net = require('net'); // For establishing socket connections
var events = require('events'); // For emitting events back to calling scripts

const INFO = 2; // Constants for referencing error levels in logging calls
const WARN = 1;
const ERROR = 0;

var IFC = {

  infiniteFlight: { // Infinite Flight connection data
    broadcastPort: 15000, // Port to listen for broadcast from Infinite Flight
    serverPort: 0, // Port for socket connection to Infinite Flight
    serverAddress: null,
    discoverSocket: false,
    clientSocket: false
  },

  enableLog: false, // Control logging -- default is false
  logLevel: ERROR, // Logging message level -- default is ERROR

  name: "IF Connect", // Module name

  isConnected: false, // Are we connected to IF?

  eventEmitter: new events.EventEmitter(), // Event emitter

  ifData: { // Object to hold data returned by information API calls
    "Fds.IFAPI.APIAircraftState": "",
    "Fds.IFAPI.APIEngineStates": "",
    "Fds.IFAPI.APIFuelTankStates": "",
    "Fds.IFAPI.APIAircraftInfo": "",
    "Fds.IFAPI.APILightsState": "",
    "Fds.IFAPI.APIAutopilotState": "",
    "Fds.IFAPI.IFAPIStatus": "",
    "Fds.IFAPI.APINearestAirportsResponse": "",
    "Fds.IFAPI.APIFlightPlan": "",
    "Fds.IFAPI.LiveAirplaneList": "",
    "Fds.IFAPI.FacilityList": "",
    "Fds.IFAPI.APIFrequencyInfoList": ""
  },

  intervalCommands: { // Commands for retrieving each data type
    "Fds.IFAPI.APIAircraftState": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIAircraftState"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "airplane.getstate",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIAircraftState [airplane.getstate]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APIEngineStates": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIEngineStates"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "airplane.getenginesstate",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIEngineStates [airplane.getenginesstate]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APIFuelTankStates": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIFuelTankStates"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "airplane.getfuelstate",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIFuelTankStates [airplane.getfuelstate]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APIAircraftInfo": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIAircraftInfo"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "airplane.getinfo",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIAircraftInfo [airplane.getinfo]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APILightsState": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APILightsState"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "airplane.getlightsstate",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APILightsState [airplane.getlightsstate]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APIAutopilotState": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIAutopilotState"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "autopilot.getstate",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIAutopilotState [autopilot.getstate]",ERROR);
        },interval);
      },
    "Fds.IFAPI.IFAPIStatus": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.IFAPIStatus"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "infiniteflight.getstatus",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.IFAPIStatus [infiniteflight.getstatus]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APINearestAirportsResponse": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APINearestAirportsResponse"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "infiniteflight.getnearestairports",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APINearestAirportsResponse [infiniteflight.getnearestairports]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APIFlightPlan": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIFlightPlan"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "flightplan.get",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIFlightPlan [flightplan.get]",ERROR);
        },interval);
      },
    "Fds.IFAPI.LiveAirplaneList": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.LiveAirplaneList"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "live.gettraffic",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.LiveAirplaneList [live.gettraffic]",ERROR);
        },interval);
      },
    "Fds.IFAPI.FacilityList": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.FacilityList"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "live.atcfacilities",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.FacilityList [live.atcfacilities]",ERROR);
        },interval);
      },
    "Fds.IFAPI.APIFrequencyInfoList": function(interval) {
      IFC.activeIntervals["Fds.IFAPI.APIFrequencyInfoList"] = setInterval(
        () => {
          IFC.sendCommand({
            "Command": "live.getcurrentcomfrequencies",
            "Parameters": []
          });
          IFC.log("Interval called Fds.IFAPI.APIFrequencyInfoList [live.getcurrentcomfrequencies]",ERROR);
        },interval);
      }
  },

  pollingIntervals: { // Interval values for polling for each info type
    "Fds.IFAPI.APIAircraftState": 0,
    "Fds.IFAPI.APIEngineStates": 0,
    "Fds.IFAPI.APIFuelTankStates": 0,
    "Fds.IFAPI.APIAircraftInfo": 0,
    "Fds.IFAPI.APILightsState": 0,
    "Fds.IFAPI.APIAutopilotState": 0,
    "Fds.IFAPI.IFAPIStatus": 0,
    "Fds.IFAPI.APINearestAirportsResponse": 0,
    "Fds.IFAPI.APIFlightPlan": 0,
    "Fds.IFAPI.LiveAirplaneList": 0,
    "Fds.IFAPI.FacilityList": 0,
    "Fds.IFAPI.APIFrequencyInfoList": 0
  },

  activeIntervals: { // Active intervals for polling for each info type
  },

  initSocketOnHostDiscovered: true,
  closeUDPSocketOnHostDiscovered: true,

  log: function(msg,level) { // generic logging function
    if (IFC.enableLog) {
      if (level <= IFC.logLevel) { console.log (IFC.name, msg); }
    }
  },

  beforeInitSocket: function() { IFC.log("Connecting...", INFO); }, // What to do before connecting to sockit

  onHostUndefined: function() { IFC.log("Host Undefined", INFO); }, // What to do if host is undefined

  onHostSearchStarted: function() { IFC.log("Searching for host", INFO); }, // What to do when starting search for host

  onSocketConnected: function() { // What to do when connected
    IFC.log("Connected", error);
  },

  onSocketConnectionError: function() { IFC.log("Connection error", ERROR); }, // What to do on a connection error

  onHostDiscovered: function(host, port, callback) { IFC.log("Host Discovered", INFO); }, // What to do when host discovered

  onDataReceived: function(dataString) { // What to do when receiving data back from API
    if (dataString.match("{")) {
      var results = IFC._dataParse(dataString);
      for (i in results) {
        var data = results[i];
        if (data.Type) { // Store structured data results in ifData objects
          IFC.log("Storing " + data.Type, ERROR);
          IFC.log("Data: " + JSON.stringify(data), INFO);
          IFC.ifData[data.Type] = data;
        }
        IFC.eventEmitter.emit('IFCdata',data); // Return data to calling script through an event
      }
    }
  },

  onHostSearchFailed: function() {}, // What to do if search failed

  // SHORTCUTS FUNCTIONS //
  init: function(successCallback, errorCallback, params) { // Initialise module
    if (successCallback) IFC.onSocketConnected = successCallback; // Set success callback function
    if (errorCallback) IFC.onSocketConnectionError = errorCallback; // Set error callback function
    if (params.intervals) IFC.setPollingIntervals(params.intervals); // Set poll timeouts
    if (params.enableLog) IFC.enableLog = params.enableLog; // Set Logging on/off
    if (params.loggingLevel) IFC.loggingLevel = params.loggingLevel; // Set logging message level
    if (params.host && params.port) { // Host provided so connect directly to it
      IFC.infiniteFlight.serverAddress = params.host;
      IFC.infiniteFlight.serverPort = params.port;
      IFC.initIFClient(IFC.infiniteFlight.serverAddress, IFC.infiniteFlight.serverPort);
    } else { // No host provided so search for a host via UDP
      IFC.searchHost(successCallback, errorCallback); // Search for Infinite Flight host
    }
  },

  searchHost: function(successCallback, errorCallback) { // Search for an Infinite Flight host
    if (IFC.infiniteFlight.discoverSocket) return;

    IFC.infiniteFlight.discoverSocket = dgram.createSocket('udp4');
    IFC.infiniteFlight.discoverSocket.on('message', function (info){
      IFC.log("Discover socket : data received", INFO);
      var dataStr = info;
      IFC.log(dataStr, INFO);
      var data = {};
      try {
        data = JSON.parse(IFC._ab2str(dataStr));
        IFC.log(data, INFO);
      } catch(e) {
        IFC.log("Discover socket : parsing error", INFO);
      }

      if (data.Addresses && data.Port) {
        IFC.log("Host Discovered", INFO);
//        IFC.isConnected = true;
//        IFC.infiniteFlight.serverAddress = data.Addresses[0];
        IFC.infiniteFlight.serverAddress = "";
  			for (var i = 0; i < data.Addresses.length; i++) { // Find an IP v4 address
  					if (isIp.v4(data.Addresses[i])) {
  							IFC.infiniteFlight.serverAddress = data.Addresses[i];
  					}
  			}
        IFC.infiniteFlight.serverPort = data.Port;

        IFC.initIFClient(IFC.infiniteFlight.serverAddress, IFC.infiniteFlight.serverPort);

        IFC.infiniteFlight.discoverSocket.close(function() {
          IFC.infiniteFlight.discoverSocket = false;
        });
      } else {
        IFC.onDataReceived(data);
      }
    });

    IFC.infiniteFlight.discoverSocket.on('listening', function(){
      var address = IFC.infiniteFlight.discoverSocket.address();
      IFC.log("IF discoverer listening on :" + address.address + ":" + address.port, INFO);
    });

    IFC.infiniteFlight.discoverSocket.bind(IFC.infiniteFlight.broadcastPort);

  },

  initIFClient: function(host, port) { // Initiaise the module
    IFC.log('initializing socket', INFO);

    if (IFC.infiniteFlight.clientSocket) IFC.infiniteFlight.clientSocket.close();

    IFC.beforeInitSocket();
    if (!host) { return IFC.onHostUndefined(); }

    IFC.infiniteFlight.clientSocket = new net.Socket();
    IFC.infiniteFlight.clientSocket.connect(port, host, function() {
    	IFC.log('Connected to IF server ' + host, ERROR);
      IFC.isConnected = true;
      IFC.startPollingIntervals();
      IFC.onSocketConnected();
    });

    IFC.infiniteFlight.clientSocket.on('data', function(data) {
    	IFC.log('Received: ' + data, INFO);
      try {
        IFC.onDataReceived(IFC._ab2str(data));
      } catch(e) {
        IFC.log(e, ERROR);
      }
    });

    IFC.infiniteFlight.clientSocket.on('close', function() {
    	IFC.infiniteFlight.clientSocket = false;
    });

  },

  cmd: function(cmd) { // Send a command to IF API -- short form
    IFC.sendCommand({
      "Command": "Commands." + cmd,
      "Parameters": []
    });
  },

  getAirplaneState: function(onDataReceived) { // Get airplane state -- redundant?
    if (onDataReceived) IFC.onDataReceived = onDataReceived;
    IFC.sendCommand({ "Command": "Airplane.GetState", "Parameters": []});
  },

  sendCommand: function(cmd) { // Send a command to IF API

    IFC.log("Sending command " + JSON.stringify(cmd), ERROR);

    try {
      var jsonStr = JSON.stringify(cmd);
      var data = new Uint8Array(jsonStr.length + 4);
      data[0] = jsonStr.length;

      for (var i = 0; i < jsonStr.length; i++) {
        data[i+4] = jsonStr.charCodeAt(i);
      }

      var buffer = Buffer.from(data);
      IFC.infiniteFlight.clientSocket.write(buffer);

      IFC.eventEmitter.emit('IFCCommandSent',cmd); // Return data to calling script through an event
      IFC.log("Emitting IFCCommandSent for " + cmd, INFO);

    } catch(e) {
      IFC.log(e);
      IFC.eventEmitter.emit('IFCCommandError',cmd); // Return data to calling script through an event
      IFC.log("Emitting IFCommandError for " + cmd, INFO);
    }
  },

  setPollingIntervals: function(intervals) { // Set poll timeouts
    for (key in intervals) {
      IFC.pollingIntervals[key] = intervals[key];
      IFC.log("Setting interval for " + key + ": " + intervals[key], ERROR);
    }
//    if (IFC.isConnected) { IFC.startPollingIntervals; }
  },

  resetPollingIntervals: function(intervals) { // Reset poll intervals and retart them
    IFC.setPollingIntervals(intervals);
    IFC.startPollingIntervals(intervals);
  },

  startPollingIntervals: function() { // Start polling
    if (IFC.isConnected) {
      for (var key in IFC.pollingIntervals) {
//        if (IFC.activeIntervals[key]) {
          IFC.log("Clear polling for " + key,ERROR);
          clearInterval(IFC.activeIntervals[key]);
//        }
        if (IFC.pollingIntervals[key] > 0) {
          IFC.log("Starting polling for " + key, ERROR);
          IFC.intervalCommands[key](IFC.pollingIntervals[key]);
/*          IFC.activeIntervals[key] = setInterval(
            () => {
              IFC.sendCommand({
                "Command": eval("IFC.intervalCommandss[key]"),
                "Parameters": []
              });
              IFC.log("Interval called " + eval("key"),ERROR);
            },
            IFC.pollingIntervals[key]
          );*/
/*          IFC.sendCommand({
            "Command": IFC.intervalCommandss[key],
            "Parameters": []
          });*/
        }
      }
    }
  },

  // Converters from https://developer.chrome.com/trunk/apps/app_hardware.html
  // String to ArrayBuffer
  _str2ab: function(str) {
    var buf=new ArrayBuffer(str.length);
    var bufView=new Uint8Array(buf);
    for (var i=0; i<str.length; i++) {
      bufView[i]=str.charCodeAt(i);
    }
    return buf;
  },

  // ArrayBuffer to String
  _ab2str: function(buf) {
    var dataString = String.fromCharCode.apply(null, new Uint8Array(buf));
    return dataString;
  },

  _dataParse: function(dataString) {
    //    var regex = /^[^{]*({[\S\s]*})[^}]*$/g;
      var regex = /}[^{^}]+{/g;
      var dataString = dataString.replace(regex, "},{")
      regex = /^[^{]*({[\S\s]*})[^}]*$/;
      dataString = dataString.replace(regex, "$1");
      regex = /:NaN/g;
      dataString = dataString.replace(regex, ":\"NaN\"");
      var resultString = "[" + dataString + "]";
      IFC.log("resultString: " + resultString,INFO);
      return JSON.parse(resultString);
  }

};

module.exports = IFC;
