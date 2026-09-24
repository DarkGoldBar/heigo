import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import RoomView from "../views/RoomView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { titleKey: "routes.home" },
    },
    {
      path: "/room/:roomId",
      name: "room",
      component: RoomView,
      meta: { titleKey: "routes.room" },
    },
  ],
});

export default router;
