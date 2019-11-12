var isIp = require('is-ip'); // Used to test if broadcast IP addresses are IPv6 vs IPv4
var dgram = require('dgram'); // For listening for UDP broadcasts
var net = require('net'); // For establishing socket connections
var events = require('events'); // For emitting events back to calling scripts

var IFC = {

  host: null, // Client host address
  port: null, // Client host port
  enableLog: false, // Control logging
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
    "Fds.IFAPI.APIFlightPlan": ""
  },

  foreFlight: { // ForFlight data
    socket: false,
    broadcastPort: 49002,
    dataModels: {
      // GPS
      "XGPSInfinite Flight": {
        "name": "GPS",
        "fields": ["lat", "lng", "alt", "hdg", "gs"]
      },
      // Attitude
      "XATTInfinite Flight": {
        "name": "attitude",
        "fields": ["hdg", "pitch", "roll"]
      },
      // Traffic
      "XTRAFFICInfinite Flight": {
        "name": "traffic",
        "fields": ["icao", "lat", "lng", "alt", "vs", "gnd", "hdg", "spd", "callsign"]
      }
    }
  },

  infiniteFlight: { // Infinite Flight connection data
    broadcastPort: 15000, // Port to listen for broadcast from Infinite Flight
    serverPort: 0, // Port for socket connection to Infinite Flight
    discoverSocket: false,
    clientSocket: false
  },

  initSocketOnHostDiscovered: true,
  closeUDPSocketOnHostDiscovered: true,

  log: function(msg) { if (IFC.enableLog) console.log(IFC.name, msg); }, // generic logging function

  beforeInitSocket: function() { IFC.log("Connecting..."); }, // What to do before connecting to sockit
  onHostUndefined: function() { IFC.log("Host Undefined"); }, // What to do if host is undefined
  onHostSearchStarted: function() { IFC.log("Searching for host"); }, // What to do when starting search for host
  onSocketConnected: function() { IFC.log("Connected"); }, // What to do when connected
  onSocketConnectionError: function() { IFC.log("Connection error"); }, // What to do on a connection error
  onHostDiscovered: function(host, port, callback) { IFC.log("Host Discovered"); }, // What to do when host discovered
  onDataReceived: function(data) { // What to do when receiving data back from API
    if (data.Type) { IFC.ifData[data.Type] = data; } // Store structured data results in ifData objects
    IFC.eventEmitter.emit('IFCdata',data); // Return data to calling script through an event
    IFC.log("Emitting IFCdata for " + data.Type);
  },
  onHostSearchFailed: function() {}, // What to do if search failed

  // SHORTCUTS FUNCTIONS //
  init: function(successCallback, errorCallback) { // Initialise module
    if (successCallback) IFC.onSocketConnected = successCallback;
    if (errorCallback) IFC.onSocketConnectionError = errorCallback;
    IFC.searchHost(successCallback, errorCallback); // Search for Infinite Flight host
  },

  initForeFlight: function(onForeFlightDataReceived) { // Initialise ForeFlight
    IFC.initForeFlightReceiver(onForeFlightDataReceived);
  },

  // FORE FLIGHT //
  onForeFlightDataReceived: function(data) { IFC.log(data); }, // Handle ForeFlight data return

  initForeFlightReceiver: function(onForeFlightDataReceived) { // ForeFlight data receiver

    if (onForeFlightDataReceived) IFC.onForeFlightDataReceived = onForeFlightDataReceived;
    if (IFC.foreFlight.socket) IFC.foreFlight.socket.close(function() {
      IFC.foreFlight.socket = false;
    });

    IFC.foreFlight.socket = dgram.createSocket('udp4');
    IFC.foreFlight.socket.on('message', function (msg, info){

      msg = IFC._ab2str(msg);
      var data = {};
      var dataParts = msg.split(",");
      var dataType = dataParts.shift();
      var dataModel = IFC.foreFlight.dataModels[dataType];

      if (!dataModel) return IFC.log("No format found for ", dataType);
      var name = dataModel.name;
      var fields = dataModel.fields;

      var log = [name];
      data._name = name;
      for (var i = 0; i < fields.length; i++) {
        log.push(fields[i] + ' : ' + dataParts[i]);
        data[fields[i]] = dataParts[i];
        IFC.onForeFlightDataReceived(data);
      }

      //IFC.log(log.join(' '));
    });

    IFC.foreFlight.socket.on('listening', function() { // Creatting Foreflight socket for listening
      var address = IFC.foreFlight.socket.address();
      IFC.log("listening on :", address.address, ":" , address.port);
    });

    IFC.foreFlight.socket.bind(IFC.foreFlight.broadcastPort);
  },

  searchHost: function(successCallback, errorCallback) { // Search for an Infinite Flight host
    if (IFC.infiniteFlight.discoverSocket) return;

    IFC.infiniteFlight.discoverSocket = dgram.createSocket('udp4');
    IFC.infiniteFlight.discoverSocket.on('message', function (info){
      IFC.log("Discover socket : data received");
      var dataStr = info;
      IFC.log(dataStr);
      var data = {};
      try {
        data = JSON.parse(IFC._ab2str(dataStr));
        IFC.log()
        IFC.log(data);
      } catch(e) {
        IFC.log("Discover socket : parsing error");
      }

      if (data.Addresses && data.Port) {
        IFC.log("Host Discovered");
        IFC.isConnected = true;
        IFC.infiniteFlight.serverAddress = data.Addresses[0];
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
      IFC.log("IF discoverer listening on :" + address.address + ":" + address.port);
    });

    IFC.infiniteFlight.discoverSocket.bind(IFC.infiniteFlight.broadcastPort);

  },

  initIFClient: function(host, port) { // Initiaise the module
    IFC.log('initializing socket');

    if (IFC.infiniteFlight.clientSocket) IFC.infiniteFlight.clientSocket.close();

    IFC.beforeInitSocket();
    if (!host) { return IFC.onHostUndefined(); }

    IFC.infiniteFlight.clientSocket = new net.Socket();
    IFC.infiniteFlight.clientSocket.connect(port, host, function() {
    	IFC.log('Connected to IF server');
      IFC.onSocketConnected();
    });

    IFC.infiniteFlight.clientSocket.on('data', function(data) {
    	IFC.log('Received: ' + data);
      try {
        IFC.onDataReceived(JSON.parse(IFC._ab2str(data)));
      } catch(e) {
        IFC.log(e);
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
    })
  },

  getAirplaneState: function(onDataReceived) { // Get airplane state -- redundant?
    if (onDataReceived) IFC.onDataReceived = onDataReceived;
    IFC.sendCommand({ "Command": "Airplane.GetState", "Parameters": []});
  },

  sendCommand: function(cmd) { // Send a command to IF API

    try {
      var jsonStr = JSON.stringify(cmd);
      var data = new Uint8Array(jsonStr.length + 4);
      data[0] = jsonStr.length;

      for (var i = 0; i < jsonStr.length; i++) {
        data[i+4] = jsonStr.charCodeAt(i);
      }

      var buffer = Buffer.from(data);
      IFC.infiniteFlight.clientSocket.write(buffer);

    } catch(e) {
        IFC.log(e);
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
    var regex = /{[\S\s]*}$/g;
    var jsonStart = dataString.search(regex);
    var resultString = dataString.slice(jsonStart,dataString.length);
    return resultString;
  },



};

module.exports = IFC;
