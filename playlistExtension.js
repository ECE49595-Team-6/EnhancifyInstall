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
    const uri = `https://api.spotify.com/v1/playlists/${playlistID}/tracks`;
    const chunks = [];
    const chunkSize = 100;
    for (let i = 0; i < sortedTrackURIs.length; i += chunkSize) {
      chunks.push(sortedTrackURIs.slice(i, i + chunkSize));
    }
    for (const chunk of chunks) {
      await PlaylistAPICall("DELETE", uri, chunk);
      await PlaylistAPICall("POST", uri, chunk);
    }
  }
  async function PlaylistAPICall(requestType, uri, chunk) {
    const accessToken = Spicetify.Platform.Session.accessToken;
    let trackURIs = [];
    if (requestType == "DELETE") {
      for (const songURI of chunk) {
        trackURIs.push({
          uri: songURI
        });
      }
    }
    let response = await fetch(uri, {
      method: requestType,
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestType == "POST" ? {
        uris: chunk
      } : {
        tracks: trackURIs
      })
    });
    if (response.status == 200) {
      console.log(requestType, " playlist API call successful!");
    } else {
      console.error("Failed ", requestType, " playlist API call: ", response.status, response.statusText);
    }
  }

  // src/extensions/playlistExtension.tsx
  var initPlaylistPageLogic = () => {
    let currentPlaylistID = null;
    const addStyles = () => {
      const style = document.createElement("style");
      style.innerHTML = `
            .preset-buttons input, .preset-buttons button, #savePresetBtn, #loadPresetBtn, #undoBtn {
                margin-left: 5px;
                margin-right: 5px;
                padding: 10px;
                color: rgba(241, 241, 241, 0.7);
                font-size: var(--encore-text-size-smaller);
                height: 32px;
            }
            .preset-buttons, #savePresetBtn, #loadPresetBtn, #undoBtn {
                display: flex;
                align-items: center;
            }
            .preset-buttons button, #savePresetBtn, #loadPresetBtn, #undoBtn {
                font-size: var(--encore-text-size-smaller);
                border-radius: 5px;
                cursor: pointer;
                border: none;
                margin-right: 5px;
            }
            .preset-buttons button:hover, #savePresetBtn:hover, #loadPresetBtn:hover, #undoBtn:hover {
                color: white;
            }
            .preset-buttons input, #savePresetBtn, #loadPresetBtn, #undoBtn {
                position: relative;
                font-size: var(--encore-text-size-smaller);
                color: rgba(241, 241, 241, 0.7);
                background-color: rgba(var(--spice-rgb-shadow), 0.7);
                border-radius: 8px;
                padding: 5px;
                margin-right: 10px;
                border: none;
            }
        `;
      document.head.appendChild(style);
    };
    addStyles();
    function isPlaylistPage() {
      const pathname = Spicetify.Platform.History.location.pathname;
      const matches = pathname.match(/playlist\/(.*)/);
      return matches ? matches[1] : null;
    }
    const waitForElement = (selector, callback, retryCount = 0) => {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
      } else if (retryCount < 10) {
        setTimeout(() => waitForElement(selector, callback, retryCount + 1), 500);
      }
    };
    const svgIconMarkup = `
        <svg data-encore-id="icon" role="img" aria-hidden="true" viewBox="0 0 16 16" class="Svg-sc-ytk21e-0 Svg-img-icon-small">
            <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0z"></path>
        </svg>
    `;
    const updateDropdownButtonText = (text) => {
      const dropdownButton = document.querySelector(".x-sortBox-sortDropdown");
      if (dropdownButton) {
        const labelSpan = dropdownButton.querySelector('[data-sortbox-label="true"]');
        if (labelSpan) {
          labelSpan.textContent = text;
        }
      }
    };
    const injectSortingOptions = (playlistID) => {
      waitForElement(".main-contextMenu-menu", (customOrderDropdown) => {
        if (!document.querySelector(".custom-sorting")) {
          const sortingOptions = `
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Acousticness</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Danceability</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Energy</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Instrumentalness</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Liveness</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Loudness</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Speechiness</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Tempo</span>
                        </button>
                    </li>
                    <li role="presentation" class="main-contextMenu-menuItem custom-sorting">
                        <button class="main-contextMenu-menuItemButton" role="menuitemradio" aria-checked="false" tabindex="-1" data-roving-interactive="0">
                            <span class="Type__TypeElement-sc-goli3j-0 TypeElement-type-mesto ellipsis-one-line" data-encore-id="type">Valence</span>
                        </button>
                    </li>
                `;
          const insertPosition = customOrderDropdown.children[7];
          if (insertPosition) {
            insertPosition.insertAdjacentHTML("beforebegin", sortingOptions);
          } else {
            customOrderDropdown.insertAdjacentHTML("beforeend", sortingOptions);
          }
          const sortingFeatures = [
            "acousticness",
            "danceability",
            "energy",
            "instrumentalness",
            "liveness",
            "loudness",
            "speechiness",
            "tempo",
            "valence"
          ];
          document.querySelectorAll(".custom-sorting button").forEach((button, index) => {
            const sortingFeature = sortingFeatures[index];
            button.addEventListener("click", () => {
              const customOrderButton = document.querySelectorAll(".main-contextMenu-menuItemButton")[0];
              if (customOrderButton) {
                customOrderButton.click();
              }
              sortPlaylistByFeature(playlistID, sortingFeature);
              document.querySelectorAll(".main-contextMenu-menuItemButton").forEach((btn, i, btns) => {
                if (i < btns.length - 2) {
                  const svg = btn.querySelector("svg");
                  if (svg)
                    svg.remove();
                }
              });
              document.querySelectorAll(".main-contextMenu-menuItemButton[aria-checked='true']").forEach((btn) => {
                btn.setAttribute("aria-checked", "false");
                btn.setAttribute("tabindex", "-1");
                btn.setAttribute("data-roving-interactive", "0");
              });
              button.setAttribute("aria-checked", "true");
              button.setAttribute("tabindex", "0");
              button.setAttribute("data-roving-interactive", "1");
              button.insertAdjacentHTML("beforeend", svgIconMarkup);
              updateDropdownButtonText(sortingFeature);
            });
          });
        }
      });
    };
    const sortPlaylistByFeature = async (playlistID, feature) => {
      const ids = await playlistTrackIDService_default(playlistID);
      const features = await multiTrackAudioFeaturesService_default(ids);
      const sortedTracks = features.filter((track) => track && track[feature] !== void 0).sort((a, b) => a[feature] - b[feature]);
      const sortedTrackURIs = sortedTracks.map((track) => `spotify:track:${track.id}`);
      await reorderPlaylist(playlistID, sortedTrackURIs);
    };
    const getSavedPresets = (playlistID) => {
      const presets = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`preset-`) && key.endsWith(`-${playlistID}`)) {
          const presetName = key.replace(`preset-`, "").replace(`-${playlistID}`, "");
          presets.push(presetName);
        }
      }
      return presets;
    };
    const setupPresetDropdown = (playlistID) => {
      const inputElement = document.getElementById("presetNameInput");
      let dropdownContainer = document.getElementById("presetDropdown");
      if (!dropdownContainer) {
        dropdownContainer = document.createElement("div");
        dropdownContainer.id = "presetDropdown";
        document.body.appendChild(dropdownContainer);
      }
      const overlayElements = document.querySelectorAll("[data-overlayscrollbars-padding], [data-overlayscrollbars-viewport], [data-overlayscrollbars]");
      const applyOverlayZIndex = (zIndex) => {
        overlayElements.forEach((element) => {
          element.style.zIndex = zIndex;
        });
      };
      dropdownContainer.style.position = "fixed";
      dropdownContainer.style.zIndex = "999";
      dropdownContainer.style.backgroundColor = "rgba(43, 43, 43, 0.9)";
      dropdownContainer.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      dropdownContainer.style.borderRadius = "4px";
      dropdownContainer.style.padding = "5px";
      dropdownContainer.style.width = `${inputElement.offsetWidth}px`;
      dropdownContainer.style.display = "none";
      const updateDropdownPosition = () => {
        const rect = inputElement.getBoundingClientRect();
        dropdownContainer.style.top = `${rect.bottom + window.scrollY}px`;
        dropdownContainer.style.left = `${rect.left + window.scrollX}px`;
      };
      inputElement.addEventListener("focus", () => {
        dropdownContainer.innerHTML = "";
        updateDropdownPosition();
        applyOverlayZIndex("999");
        const savedPresets = getSavedPresets(playlistID);
        savedPresets.forEach((preset) => {
          const presetItem = document.createElement("div");
          presetItem.textContent = preset;
          presetItem.style.padding = "5px";
          presetItem.style.cursor = "pointer";
          presetItem.style.color = "white";
          presetItem.addEventListener("click", () => {
            inputElement.value = preset;
            dropdownContainer.style.display = "none";
            applyOverlayZIndex("");
          });
          dropdownContainer.appendChild(presetItem);
        });
        dropdownContainer.style.display = savedPresets.length > 0 ? "block" : "none";
      });
      inputElement.addEventListener("blur", () => {
        setTimeout(() => {
          dropdownContainer.style.display = "none";
          applyOverlayZIndex("");
        }, 150);
      });
      window.addEventListener("resize", updateDropdownPosition);
      window.addEventListener("scroll", updateDropdownPosition);
    };
    const injectPresetButtons = (playlistID) => {
      waitForElement(".main-actionBar-ActionBarRow", (container) => {
        var _a, _b;
        const customOrderButton = container.querySelector(".x-sortBox-sortDropdown");
        if (customOrderButton && !document.querySelector(".preset-buttons")) {
          const buttonHTML = `
                    <div class="preset-buttons settingContainer" style="display: flex; position: relative;">
                        <input id="presetNameInput" class="settingLabel" type="text" placeholder="Preset Name" style="color: white; background-color: rgb(43, 43, 43); border: none; border-radius: 5px; padding: 5px;"/>
                        <div id="presetDropdown" class="preset-dropdown" style="display: none; position: absolute; top: 35px; background-color: rgba(43, 43, 43, 0.9); border: 1px solid rgba(81, 126, 97, 0.8); border-radius: 5px; z-index: 10;"></div>
                        <button id="savePresetBtn">Save Preset</button>
                        <button id="loadPresetBtn">Load Preset</button>
                    </div>
                `;
          customOrderButton.insertAdjacentHTML("beforebegin", buttonHTML);
          setupPresetDropdown(playlistID);
          (_a = document.getElementById("savePresetBtn")) == null ? void 0 : _a.addEventListener("click", () => {
            const presetName = document.getElementById("presetNameInput").value;
            savePreset(presetName, playlistID);
          });
          (_b = document.getElementById("loadPresetBtn")) == null ? void 0 : _b.addEventListener("click", () => {
            const presetName = document.getElementById("presetNameInput").value;
            loadPreset(presetName, playlistID);
          });
        }
      });
    };
    const savePreset = async (name, playlistID) => {
      const ids = await playlistTrackIDService_default(playlistID);
      const prefixedTrackOrder = ids.map((id) => `spotify:track:${id}`);
      const preset = {
        name,
        trackOrder: prefixedTrackOrder
      };
      localStorage.setItem(`preset-${name}-${playlistID}`, JSON.stringify(preset));
      Spicetify.showNotification(`Preset saved.`);
    };
    const loadPreset = async (name, playlistID) => {
      const preset = JSON.parse(localStorage.getItem(`preset-${name}-${playlistID}`) || "{}");
      if (preset && preset.trackOrder) {
        const dropdownToggleButton = document.querySelector(".x-sortBox-sortDropdown");
        if (dropdownToggleButton) {
          dropdownToggleButton.click();
          setTimeout(() => {
            const dropdownButtons = document.querySelectorAll(".main-contextMenu-menuItemButton");
            if (dropdownButtons[0]) {
              dropdownButtons[0].click();
              document.querySelectorAll(".main-contextMenu-menuItemButton").forEach((btn, i, btns) => {
                if (i < btns.length - 2) {
                  const svg = btn.querySelector("svg");
                  if (svg)
                    svg.remove();
                }
              });
              document.querySelectorAll(".main-contextMenu-menuItemButton[aria-checked='true']").forEach((btn) => {
                btn.setAttribute("aria-checked", "false");
                btn.setAttribute("tabindex", "-1");
                btn.setAttribute("data-roving-interactive", "0");
              });
              dropdownButtons[0].setAttribute("aria-checked", "true");
              dropdownButtons[0].setAttribute("tabindex", "0");
              dropdownButtons[0].setAttribute("data-roving-interactive", "1");
              dropdownButtons[0].insertAdjacentHTML("beforeend", svgIconMarkup);
            } else {
              console.error("Custom order option not found");
            }
            reorderPlaylist(playlistID, preset.trackOrder);
          }, 10);
        } else {
          console.error("Dropdown toggle button not found");
        }
      } else {
        Spicetify.showNotification(`Preset '${name}' not found.`);
      }
    };
    const observeDropdownOpen = () => {
      waitForElement(".x-sortBox-sortDropdown", (dropdownButton) => {
        const dropdownObserver = new MutationObserver(() => {
          const isExpanded = dropdownButton.getAttribute("aria-expanded") === "true";
          const isContextMenuOpen = dropdownButton.getAttribute("data-context-menu-open") === "true";
          if (isExpanded && isContextMenuOpen && currentPlaylistID) {
            injectSortingOptions(currentPlaylistID);
          }
        });
        dropdownObserver.observe(dropdownButton, {
          attributes: true,
          attributeFilter: ["aria-expanded", "data-context-menu-open"]
        });
      });
    };
    const observer = new MutationObserver(() => {
      const playlistID = isPlaylistPage();
      if (playlistID && playlistID !== currentPlaylistID) {
        currentPlaylistID = playlistID;
        observeDropdownOpen();
        injectPresetButtons(playlistID);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };
  initPlaylistPageLogic();
  Spicetify.Platform.History.listen(() => {
    initPlaylistPageLogic();
  });
})();

        })();