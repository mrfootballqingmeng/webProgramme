async function fetchWeather() {
  const apiKey = "670547e6da46825d0310f0b0cf3af21c"; // TODO: 替换成你的OpenWeather API Key
  const url = `https://api.openweathermap.org/data/2.5/weather?q=Singapore&units=metric&appid=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    document.getElementById("weather").innerText = `${data.weather[0].description}, ${data.main.temp}°C`;
  } catch (err) {
    console.error(err);
  }
}
fetchWeather();
