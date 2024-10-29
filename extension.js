(async function() {
          while (!Spicetify.React || !Spicetify.ReactDOM) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          "use strict";
var Enhancify = (() => {
  // src/extensions/extension.tsx
  (async () => {
    while (!(Spicetify == null ? void 0 : Spicetify.showNotification)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    Spicetify.showNotification("Welcome!");
  })();
})();

        })();