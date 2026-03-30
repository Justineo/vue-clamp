import { createApp } from "vue";
import App from "./App.vue";
import BenchmarkPage from "./BenchmarkPage.vue";
import "./style.css";

const query = new URLSearchParams(window.location.search);
const RootComponent = query.get("view") === "benchmark" ? BenchmarkPage : App;

createApp(RootComponent).mount("#app");
