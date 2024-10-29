(async function() {
          while (!Spicetify.React || !Spicetify.ReactDOM) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          "use strict";
var Enhancify = (() => {
  // src/services/multiTrackAudioFeaturesService.tsx
  async function getMultiTrackAudioFeatures(songIDs) {
    if (!songIDs || songIDs.length === 0) {
      return [];
    }
    const accessToken = Spicetify.Platform.Session.accessToken;
    let allAudioFeatures = [];
    const chunks = [];
    const chunkSize = 100;
    for (let i = 0; i < songIDs.length; i += chunkSize) {
      chunks.push(songIDs.slice(i, i + chunkSize));
    }
    for (const chunk of chunks) {
      const idsString = chunk.join(",");
      const response = await fetch(
        `https://api.spotify.com/v1/audio-features?ids=${idsString}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      if (response.status === 200) {
        const data = await response.json();
        if (data && data.audio_features) {
          allAudioFeatures = allAudioFeatures.concat(data.audio_features.filter(Boolean));
        }
      } else {
        console.error("Failed to fetch audio features for chunk:", chunk);
      }
    }
    return allAudioFeatures;
  }
  var multiTrackAudioFeaturesService_default = getMultiTrackAudioFeatures;

  // src/services/playlistTrackIDService.tsx
  async function getPlaylistTrackIDs(playlistID) {
    if (!playlistID) {
      return [];
    }
    const accessToken = Spicetify.Platform.Session.accessToken;
    let trackIDs = [];
    let nextURL = `https://api.spotify.com/v1/playlists/${playlistID}/tracks`;
    while (nextURL) {
      const response = await fetch(nextURL, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (response.status !== 200) {
        return [];
      }
      const data = await response.json();
      const ids = data.items.filter((item) => item.track && item.track.id).map((item) => item.track.id);
      trackIDs = trackIDs.concat(ids);
      nextURL = data.next;
    }
    return trackIDs;
  }
  var playlistTrackIDService_default = getPlaylistTrackIDs;

  // src/services/reorderPlaylistService.tsx
  async function reorderPlaylist(playlistID, sortedTrackURIs) {
    if (!playlistID || !sortedTrackURIs.length) {
      console.error("No playlist ID or sorted tracks provided.");
      return;
    }
    const accessToken = Spicetify.Platform.Session.accessToken;
    const uri = `https://api.spotify.com/v1/playlists/${playlistID}/tracks`;
    const response = await fetch(uri, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uris: sortedTrackURIs
      })
    });
    if (response.ok) {
      console.log("Playlist successfully reordered!");
      return response.json();
    } else {
      console.error("Failed to reorder playlist:", response.status, response.statusText);
    }
  }

  // src/extensions/playlistExtension.tsx
  var initPlaylistPageLogic = () => {
    let currentPlaylistID = null;
    const waitForSpicetify = (callback, retryCount = 0) => {
      if (retryCount > 10) {
        console.error("Spicetify is not ready after multiple attempts.");
        return;
      }
      if (typeof Spicetify !== "undefined" && Spicetify.Player && Spicetify.Player.data) {
        callback();
      } else {
        console.log(`Spicetify not ready, retrying... (${retryCount + 1})`);
        setTimeout(() => waitForSpicetify(callback, retryCount + 1), 500);
      }
    };
    function isPlaylistPage() {
      const pathname = Spicetify.Platform.History.location.pathname;
      const matches = pathname.match(/playlist\/(.*)/);
      if (!matches)
        return null;
      return matches[1];
    }
    const waitForElement = (selector, callback, retryCount = 0) => {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
      } else if (retryCount < 10) {
        console.log(`Element ${selector} not found, retrying... (${retryCount + 1})`);
        setTimeout(() => waitForElement(selector, callback, retryCount + 1), 500);
      } else {
        console.error(`Element ${selector} not found after multiple attempts.`);
      }
    };
    const clickCustomOrderButtonAndInject = (playlistID) => {
      console.log("Attempting to click custom order button...");
      waitForElement(".x-sortBox-sortDropdown", (customOrderButton) => {
        console.log("Custom order button found:", customOrderButton);
        customOrderButton.click();
        setTimeout(() => injectSortingOptions(playlistID), 500);
      });
    };
    const injectSortingOptions = (playlistID) => {
      console.log("Injecting sorting options...");
      waitForElement(".main-contextMenu-menu", (customOrderDropdown) => {
        console.log("Custom order dropdown element:", customOrderDropdown);
        if (!document.querySelector(".custom-sorting")) {
          const newSortingOptions = `
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto">Tempo</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto">Danceability</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto">Energy</span>
                        </button>
                    </li>
                `;
          customOrderDropdown.insertAdjacentHTML("beforeend", newSortingOptions);
          document.querySelectorAll(".custom-sorting button").forEach((button, index) => {
            const sortingFeature = ["tempo", "danceability", "energy"][index];
            button.addEventListener("click", () => sortPlaylistByFeature(playlistID, sortingFeature));
          });
        }
      });
    };
    const sortPlaylistByFeature = async (playlistID, feature) => {
      console.log(`Sorting playlist by feature: ${feature}`);
      const ids = await playlistTrackIDService_default(playlistID);
      console.log(`Track IDs: ${ids}`);
      const features = await multiTrackAudioFeaturesService_default(ids);
      console.log(`Audio Features:`, features);
      const sortedTracks = features.filter((track) => track && track[feature] !== void 0).sort((a, b) => a[feature] - b[feature]);
      console.log(`Sorted Tracks:`, sortedTracks);
      const sortedTrackURIs = sortedTracks.map((track) => `spotify:track:${track.id}`);
      console.log(`Sorted Track URIs: ${sortedTrackURIs}`);
      const result = await reorderPlaylist(playlistID, sortedTrackURIs);
      console.log(`Reorder result:`, result);
    };
    const injectPresetButtons = (playlistID) => {
      console.log("Injecting preset buttons...");
      waitForElement(".main-actionBar-ActionBarRow", (container) => {
        console.log("Action bar element:", container);
        const customOrderButton = container.querySelector(".x-sortBox-sortDropdown");
        console.log("Custom order button element:", customOrderButton);
        if (customOrderButton && !document.querySelector(".preset-buttons")) {
          const buttonHTML = `
					<div class="preset-buttons settingContainer" style="display: flex; margin-right: 20px;">
						<input id="presetNameInput" class="settingLabel" type="text" placeholder="Preset Name" style="color: white; background-color: rgb(43, 43, 43); border: none; border-radius: 5px; padding: 5px;"/>
						<button id="savePresetBtn" class="Button-sc-qlcn5g-0 Button-buttonPrimary-useBrowserDefaultFocusStyle-data-is-icon-only settingLabel">Save Preset</button>
						<button id="loadPresetBtn" class="Button-sc-qlcn5g-0 Button-buttonPrimary-useBrowserDefaultFocusStyle-data-is-icon-only settingLabel">Load Preset</button>
						<button id="undoBtn" class="Button-sc-qlcn5g-0 Button-buttonPrimary-useBrowserDefaultFocusStyle-data-is-icon-only settingLabel">Undo</button>
					</div>
				`;
          customOrderButton.insertAdjacentHTML("beforebegin", buttonHTML);
          let presetName = "";
          document.getElementById("savePresetBtn").addEventListener("click", () => savePreset(presetName, playlistID));
          document.getElementById("loadPresetBtn").addEventListener("click", () => loadPreset(presetName, playlistID));
          document.getElementById("undoBtn").addEventListener("click", () => undoOrder(playlistID));
          document.getElementById("presetNameInput").addEventListener("input", (e) => {
            presetName = e.target.value;
          });
        } else {
          console.log("Preset buttons already injected or Custom order button not found.");
        }
      });
    };
    const savePreset = (name, playlistID) => {
      const preset = {
        name,
        trackOrder: []
      };
      localStorage.setItem(`preset-${name}`, JSON.stringify(preset));
      alert(`Preset '${name}' saved.`);
    };
    const loadPreset = (name, playlistID) => {
      const preset = JSON.parse(localStorage.getItem(`preset-${name}`) || "{}");
      if (preset && preset.trackOrder) {
        reorderPlaylist(playlistID, preset.trackOrder);
      } else {
        alert(`Preset '${name}' not found.`);
      }
    };
    const undoOrder = (playlistID) => {
      alert(`Undoing the order for playlist ID: ${playlistID}`);
    };
    waitForSpicetify(() => {
      console.log("Spicetify is ready, checking if it's a playlist page...");
      const playlistID = isPlaylistPage();
      if (playlistID) {
        console.log("Valid playlist page detected, playlist ID:", playlistID);
        clickCustomOrderButtonAndInject(playlistID);
        injectPresetButtons(playlistID);
      } else {
        console.log("Not a playlist page.");
      }
      Spicetify.Platform.History.listen(() => {
        const newPlaylistID = isPlaylistPage();
        if (newPlaylistID && newPlaylistID !== currentPlaylistID) {
          console.log("Navigated to a new playlist page, playlist ID:", newPlaylistID);
          currentPlaylistID = newPlaylistID;
          clickCustomOrderButtonAndInject(newPlaylistID);
          injectPresetButtons(newPlaylistID);
        }
      });
    });
  };
  initPlaylistPageLogic();
})();

        })();