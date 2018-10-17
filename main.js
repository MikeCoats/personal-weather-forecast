// Grab the two libraries we use for getting data and sending messages
const request = require('request-promise-native');
const twilio = require('twilio');

// Get all the environment variables up front.
const darkskyApiKey = process.env.DARKSKY_KEY;
const darkskyLatLong = process.env.DARKSKY_LATLONG;
const twilioAccount = process.env.TWILIO_ACCOUNT;
const twilioToken = process.env.TWILIO_TOKEN;
const twilioFrom = process.env.TWILIO_FROM;
const twilioTo = process.env.TWILIO_TO;

// If any of them are not set, exit with an error now.
if (
  !darkskyApiKey ||
  !darkskyLatLong ||
  !twilioAccount ||
  !twilioToken ||
  !twilioFrom ||
  !twilioTo
) {

  // Log the error.
  console.error(
    'All of the DARKSKY_KEY, DARKSKY_LATLONG, TWILIO_ACCOUNT, TWILIO_TOKEN, ' +
      'TWILIO_FROM, TWILIO_TO environment variables must be set before ' +
      'running the program.'
  );

  // Exit with a failure errorlevel.
  process.exit(1);
}

// Thes are the icons we're going to use to represent darksky's machine icons
// in text messages.
const icons = {
  'clear-day': '☀️',
  'clear-night': '🌘',
  rain: '🌧',
  snow: '❄️',
  sleet: 'e',
  wind: '💨',
  fog: '🌫',
  cloudy: '☁️',
  'partly-cloudy-day': '⛅️',
  'partly-cloudy-night': '⛅️',
};

// These are some hardcoded endpoint variables that set up the forecast call.
const forecastEndpoint = 'https://api.darksky.net/forecast';
const queryParams = 'units=uk2&exclude=currently,minutely,alerts,flags';

// Calculate the offest required for daylight savings. All of the times are
// returned in +00:00 time, so we need to see what today's current offset away
// from that is.
const offset = new Date(Date.now()).getTimezoneOffset() * 60 * 1000;

// Given a parsed daily object from the JSON string returned by DarkSky, turn
// it into a textual summary.
const generateDailySummary = daily => {
  // Get darksky's own summary to start with.
  const text = daily.summary.toLowerCase();

  // Get the day's temperature range.
  const min = Math.floor(daily.temperatureMin);
  const max = Math.floor(daily.temperatureMax);

  // Get the day's 'feels-like' range.
  const feelMin = Math.floor(daily.apparentTemperatureMin);
  const feelMax = Math.floor(daily.apparentTemperatureMax);

  // Get the chance of rain, or if it's not rain, what it is.
  const precipChance = Math.floor(daily.precipProbability * 100.0);
  const precipKind = daily.precipType;

  // Get the sunrise and sunset times and apply the BST/DST offest to them.
  const sunrise = new Date(
    parseInt(daily.sunriseTime) * 1000 - offset
  ).toLocaleTimeString('en-GB');
  const sunset = new Date(
    parseInt(daily.sunsetTime) * 1000 - offset
  ).toLocaleTimeString('en-GB');

  // Return one massive big string concatenated results message.
  return (
    'Good Morning! Your weather forcecast for today is ' +
    text +
    ' The temperature will be ' +
    min +
    '–' +
    max +
    '°c, which will feel like ' +
    feelMin +
    '–' +
    feelMax +
    "°c. There's a " +
    precipChance +
    '% chance of ' +
    precipKind +
    " and today's sunrise is at " +
    sunrise +
    ' with sunset due at ' +
    sunset +
    '.'
  );
};

// Given a parsed hourly object from the JSON string returned by DarkSky, turn
// it into a textual summary.
const generateHourlySummary = hourly => {
  // This is bad/dark magic. We're asking for a localeTime...
  const time = new Date(
    parseInt(hourly.time) * 1000 - offset
  ).toLocaleTimeString('en-GB');

  //  ...and then doing string splitting to make a human readable short-time.
  const timeOfForecast = time.split(':')[0] + ' ' + time.split(' ')[1];

  // Darksky give us the forecast to decimal places - whole numbers will do.
  const forecastTemperature = Math.floor(hourly.temperature);

  // Get the emoji version of darksky's icons
  const forecastConditions = icons[hourly.icon];

  // Return one massive big string concatenated results message.
  return (
    timeOfForecast + ' : ' + forecastTemperature + '°c ' + forecastConditions
  );
};

// Make the Darksky API call and process the results into the body of our text
// message.
const generateSummary = async () => {
  // Grab the API call's result as stringified JSON.
  const result = await request(
    forecastEndpoint +
      '/' +
      darkskyApiKey +
      '/' +
      darkskyLatLong +
      '?' +
      queryParams
  );

  // Turn the string into a JSON object.
  const forecast = JSON.parse(result);

  // Grab a summarised version of the first day in the results.
  const dailySummary = generateDailySummary(forecast.daily.data[0]);

  // Start the whole forecast off with that summary.
  let summary = dailySummary + '\n';

  // Get the forecasts for the next 10 hours.
  for (let hourly of forecast.hourly.data.slice(0, 10)) {
    // Turn each of those objects into summaries.
    const hourlySummary = generateHourlySummary(hourly);

    // Append them to the running summary variable.
    summary = summary + '\n' + hourlySummary;
  }

  // Return back the biggest blog of emoji filled text you've ever seen.
  return summary;
};

// Use Twilio to send a text message.
const sendMessage = async summary => {
  // Create the client connection.
  const client = twilio(twilioAccount, twilioToken);

  // Create a message object and wait for it to send.
  const message = await client.messages.create({
    body: summary,
    from: twilioFrom,
    to: twilioTo,
  });

  // Return the response object for consumption.
  return message;
};

// Our main function - it has to be inside a function and not bare in the file
// as we're using async/await calling.
const main = async () => {
  // The API calls and the results parsing could die, so we should wrap them
  // in a try/catch block.
  try {
    // Ask Darksky for a forecast and return a textual summary.
    const summary = await generateSummary();

    // Use Twilio to send it as an SMS.
    const message = await sendMessage(summary);

    // Check for error state in the message repsonse
    if (message.errorCode != null || message.errorMessage != null) {
      // If there is, log the error.
      console.error('Error code    : ' + message.errorCode);
      console.error('Error message : ' + message.errorMessage);

      // And exit with an errorlevel.
      process.exit(2);
    }
  } catch (err) {
    // If any errors occur report them to the user.
    console.error(err);
  }
};

// Run our main function - it uses async and await to avoid callback or
// promise hell.
main();
