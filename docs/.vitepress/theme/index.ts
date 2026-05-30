import { h } from 'vue'
import { useRoute, withBase } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import MaltApp from './components/MaltApp.vue'
import { isAppStateRoute } from './malt-client.mjs'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout() {
    const route = useRoute()
    const pathname = typeof window === 'undefined' ? route.path : window.location.pathname
    if (isAppStateRoute(withBase('/app'), pathname)) {
      return h(MaltApp)
    }
    return h(DefaultTheme.Layout)
  }
}
