# node-red-contrib-state-trail

[![NPM version][npm-image]][npm-url]
[![CodeFactor](https://www.codefactor.io/repository/github/hotnipi/node-red-contrib-ui-state-trail/badge)](https://www.codefactor.io/repository/github/hotnipi/node-red-contrib-ui-state-trail)
![npm](https://img.shields.io/npm/dm/node-red-contrib-ui-state-trail)

[npm-image]: http://img.shields.io/npm/v/node-red-contrib-ui-state-trail.svg
[npm-url]: https://www.npmjs.com/package/node-red-contrib-ui-state-trail


## Description
![node-red-contrib-ui-state-trail.JPG](images/node-red-contrib-ui-state-trail.JPG)

Node-RED dashboard widget. Gantt type chart to visualize state changes over time period.

## Configuration
### Label
To show label configure widget height to 2 units. 
  
### Period
Time period. If configured to long period, keep input rate low. Too much data may harm performance significantly.
        

### Time format and Ticks
Choose format of time and count of tick marks.
     
### States
Configure at least 2 states. Type of state can be <code>string</code>, <code>number</code> or <code>boolean</code>.  
States can be configured with mixing the types. States <code>true</code> (boolean) and <code>"true"</code> (string) treated as different states. 

### Blank label
Text to show when there is not yet enough data to display the chart. 

### Input
        
<code>msg.payload</code> should carry single value of one of configured states
<code>msg.payload = true</code> 

If you want to use the widget to show historical data, you need to pass in every state together with its timestamp. 
<code>msg.payload = {state:true,timestamp:1579362774639}</code>

To clear the data, send an empty array <code>msg.payload = []</code> 