// Loaded on demand by StatChart (dynamic import), so Chart.js ships only to the admin pages that draw a chart.
import { BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from "chart.js";

Chart.register(LineController, BarController, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
Chart.defaults.color = "#5a6480";

export { Chart };
