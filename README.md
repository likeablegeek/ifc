# ifc

A Javascript client for Infinite Flight simulator API

This version is forked from the version originally created by NicolasBD (https://github.com/nicolasbd/ifc) and subsequently forked and updated by Velocity23 (https://github.com/Velocity23/ifc).

This fork makes some key changes and extensions:

1. Stores the results of calls to information calls (such as Airplane.GetState) in an object so that the last fetched data can easily be retrieved by the calling script.
2. Provides a "polling" mechanism where the calling script can ask the module to poll any of the information calls on a regular basis (i.e. every second or every minute) -- this can be useful for applications which need regular data updates from Infinite Flight.
3. Emits events when data/information is returned by the API so that calling scripts can respond to those events.
4. Emits events when sending an API command succeeds or fails.


## Connection to Infinite Flight Connect API

Infinite Flight Connect is an built-in API that allows you to send command to Infinite Flight. You must enable it in Infinite Flight Settings > General > "Enable Infinite Flight Connect".

### Initialization

`init(successCallback, errorCallback)`

* `successCallback` is the function to be executed after the connection has been established with Infinite Flight
* `errorCallback` is the function to be executed in case of error connecting
* `timeouts` is an object containing a list of polling intervals for information functions (see the section on "Polling")

Example :

```
IFC.init(
  function() {
    console.log("IFC connected");
    IFC.sendCommand({ "Command": "Commands.FlapsDown", "Parameters": []});
  },
  function() {
    IFC.log("IFC connection error");
  },
  {
    "Fds.IFAPI.APIAircraftState": 1000,
    "Fds.IFAPI.APIFuelTankStates": 5000
  }
)
```

## Using the Infinite Flight Connect API through `ifc`


### Sending a Command

To send a command to Infinite Flight, you may use the shortcut function `IFC.cmd()` or the full function for complex commands. You'll find a full list of commands on the [API Docs repo](https://github.com/flyingdevelopmentstudio/infiniteflight-api)

Examples :
* Flaps Down : `IFC.cmd("FlapsDown")` will lower the flaps down. (Full Command equivalent is: `IFC.sendCommand({ "Command": "Commands.FlapsDown", "Parameters": []});`
* Camera Move : this one require params, so let's call the full command call : ` "Command": "NetworkJoystick.SetPOVState", "Parameters": [ { "Name": "X", "Value": 0 }, { "Name": "Y", "Value": 0 } ] }`


### Calling Information Functions

The Infinite API has a series of information-fetching functions which return structured data from Infinite Flight:

* `Airplane.GetState` : Returns the full aircraft state.
* `Airplane.GetEngineState` : Returns the aircraft engine states.
* `Airplane.GetFuelState` : Returns the aircraft fuel tank states.
* `Airplane.GetInfo` : Returns the full aircraft information.
* `Airplane.GetLightsState` : Returns the state of the aircraft lights.
* `Autopilot.GetState` : Returns the autopilot state.
* `Infiniteflight.GetStatus` : Returns the status of the Infinite Flight application.
* `Infinitefight.GetNearestAirports`: Returns a list of the nearest airports.
* `Flightplan.Get`: Returns flight plan information.

Each of these functions is associated with a data type name which is used by the `ifc` module for retrieving the results of calls to these functions as well as setting regular polling intervals for any of these types of information:

* `Airplane.GetState` : `Fds.IFAPI.APIAircraftState`
* `Airplane.GetEngineState` : `Fds.IFAPI.APIEngineStates`
* `Airplane.GetFuelState` : `Fds.IFAPI.APIFuelTankStates`
* `Airplane.GetInfo` : `Fds.IFAPI.APIAircraftInfo`
* `Airplane.GetLightsState` : `Fds.IFAPI.APILightsState`
* `Autopilot.GetState` : `Fds.IFAPI.APIAutopilotState`
* `Infiniteflight.GetStatus` : `Fds.IFAPI.IFAPIStatus`
* `Infinitefight.GetNearestAirports`: `Fds.IFAPI.APINearestAirportsResponse`
* `Flightplan.Get`: `Fds.IFAPI.APIFlightPlan`

Every time one of these functions is called and the API returns data, the data is stored in the `IFData` object in the `ifc` module so the calling script can retrieve it.

For instance, if you have called `Airplane.GetState` and data has been returned, it can be retrieved via `IFC.ifData["Fds.IFAPI.APIAircraftState"]`.

(TODO: Add "Live" information functions once tested)


### Events

The module emits the following events:

* `IFCData`: Emitted when data is returned by the API - such as after calling a function such as `Airplane.GetState`; the event returns the results from the API to listeners as a JSON object.
* `IFCCommandSent`: Emitted after a command is successfully sent to the API; the event returns the command sent to the API to listeners as a string.
* `IFCCommandError`: Emitted after a command fails to be sent to the API; the API returns the command which failed to send to listeners as a string.

The following is an example of binding an event to the `IFCData` events in a calling scripts:

```
var IFC = require("ifc");

IFC.eventEmitter.addListener('IFCdata', function(results) {
  // perform actions on the Results
  console.log(results.Type);
});
```

### Polling

Some applications will need o regularly call information functions in the API at set intervals.

For instance, an application which needs to display the fuel level in tanks may need to fetch the results of `Airplane.GetFuelState` every second.

You can define polling intervals for any of the information types at the time you call the `IFC.init()` function by passing the optional `timeouts` parameter.

In the example below, two intervals are set:

* For `Fds.IFAPI.APIAircraftState` a polling interval is set every one second (1000 milliseconds).
* For `Fds.IFAPI.APIFuelTankStates` a polling interval is set every five seconds (5000 milliseconds).

```
IFC.init(
  function() {
    console.log("IFC connected");
    IFC.sendCommand({ "Command": "Commands.FlapsDown", "Parameters": []});
  },
  function() {
    IFC.log("IFC connection error");
  },
  {
    "Fds.IFAPI.APIAircraftState": 1000,
    "Fds.IFAPI.APIFuelTankStates": 5000
  }
)
```

At any point you can change the polling intervals for any information type by calling `IFC.setPollTimeouts` and passing a similar `timeouts` object as a parameter. You can cancel a polling interval by setting the interval to zero (0) milliseconds.

For instance, to cancel the interval for `Fds.IFAPI.APIFuelTankStates` and set the interval for `Fds.IFAPI.APIAircraftState` to three seconds you would call `setPollTimeouts` as follows:

```
IFC.setPollTimeouts({
  "Fds.IFAPI.APIAircraftState": 3000,
  "Fds.IFAPI.APIFuelTankStates": 0  
});
```


## Connection to ForeFlight Link API

Fore Flight Link broadcasts various data about the player's plane and traffic planes around him. ForeFlight Link must be enabled from Infinite Flight Settings > General > Enable ForeFlight Link

You can use `ifc` to listen to ForeFlight Link messages :

`initForeFlight(onForeFlightDataReceived)`

(TODO: example to come ...)

Received Data is formatted according to the official documentation : https://www.foreflight.com/support/network-gps/


## Copyright and License

This version of `ifc` is a fork and derivative version of two previous versions:

- Original version by @nicolasbd (https://github.com/nicolasbd/ifc)
- Initial fork by @Velocity23 (https://github.com/Velocity23/ifc)

Both previous versions were released under the Apache 2.0 license (http://www.apache.org/licenses/LICENSE-2.0) as is this version.

This version is Copyright 2019, @likeablegeek, with components from previous versions copyright by the two authors noted above.

You may not use this work/module/file except in compliance with the License. Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
