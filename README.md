# personal-weather-forecast

A small program to read the weather from DarkSky and text it to you over Twilio.

## Running

A small script like this (with all of the variables filled) should be saved somewhere on your path and executed, passing in your auth credentials to the script for consumption.

```sh
#!/bin/sh

export DARKSKY_KEY=[your-darksky-key]
export DARKSKY_LATLONG=[the-location-for-the-forecast]
export TWILIO_ACCOUNT=[your-twilio-account-sid]
export TWILIO_TOKEN=[your-twilio-auth-token]
export TWILIO_FROM=[your-twilio-phone-number]
export TWILIO_TO=[your-destination-phone-number]

pushd /[wherever-you-checked-out-the-repo]/personal-weather-forecast >/dev/null
node main.js
popd >/dev/null
```
