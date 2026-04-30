const fs = require('fs');
const path = require('path');

const map = {
  'ri-landscape-line': 'mgc_scenery_line',
  'ri-map-pin-line': 'mgc_location_line',
  'ri-map-pin-fill': 'mgc_location_fill',
  'ri-restaurant-line': 'mgc_fork_spoon_line',
  'ri-list-check-2': 'mgc_list_check_line',
  'ri-map-2-line': 'mgc_map_line',
  'ri-ticket-2-line': 'mgc_ticket_line',
  'ri-add-line': 'mgc_add_line',
  'ri-arrow-right-s-line': 'mgc_right_line',
  'ri-checkbox-circle-fill': 'mgc_check_circle_fill',
  'ri-close-line': 'mgc_close_line',
  'ri-file-list-3-line': 'mgc_document_line',
  'ri-lightbulb-flash-line': 'mgc_bulb_line',
  'ri-search-line': 'mgc_search_line',
  'ri-star-fill': 'mgc_star_fill',
  'ri-store-2-line': 'mgc_store_line',
  'ri-thumb-up-line': 'mgc_thumb_up_line',
  'ri-bank-line': 'mgc_bank_line',
  'ri-building-2-line': 'mgc_building_2_line',
  'ri-building-line': 'mgc_building_line',
  'ri-cup-line': 'mgc_drink_line',
  'ri-fire-line': 'mgc_fire_line',
  'ri-global-line': 'mgc_earth_line',
  'ri-hotel-bed-line': 'mgc_bed_line',
  'ri-map-pin-user-line': 'mgc_location_line',
  'ri-shopping-bag-3-line': 'mgc_shopping_bag_2_line',
  'ri-tree-line': 'mgc_tree_line',
  'ri-arrow-down-s-line': 'mgc_down_line',
  'ri-bowl-line': 'mgc_bowl_line',
  'ri-checkbox-circle-line': 'mgc_check_circle_line',
  'ri-compass-3-line': 'mgc_compass_line',
  'ri-focus-3-line': 'mgc_target_line',
  'ri-heart-3-fill': 'mgc_heart_fill',
  'ri-heart-3-line': 'mgc_heart_line',
  'ri-leaf-line': 'mgc_leaf_line',
  'ri-sparkling-2-line': 'mgc_sparkles_line',
  'ri-star-line': 'mgc_star_line',
  'ri-sun-cloudy-line': 'mgc_sun_cloud_line',
  'ri-ticket-line': 'mgc_ticket_line',
  'ri-time-line': 'mgc_time_line',
  'ri-delete-bin-line': 'mgc_delete_2_line',
  'ri-settings-3-line': 'mgc_settings_3_line',
  'ri-arrow-down-line': 'mgc_arrow_down_line',
  'ri-arrow-left-s-line': 'mgc_left_line',
  'ri-arrow-up-line': 'mgc_arrow_up_line',
  'ri-arrow-up-s-line': 'mgc_up_line',
  'ri-car-line': 'mgc_car_line',
  'ri-check-line': 'mgc_check_line',
  'ri-checkbox-blank-circle-fill': 'mgc_circle_fill',
  'ri-cursor-line': 'mgc_cursor_line',
  'ri-flashlight-line': 'mgc_flashlight_line',
  'ri-fullscreen-exit-line': 'mgc_fullscreen_exit_2_line',
  'ri-navigation-line': 'mgc_send_plane_line',
  'ri-party-fill': 'mgc_celebrate_fill',
  'ri-pencil-line': 'mgc_pencil_line',
  'ri-rocket-line': 'mgc_rocket_line',
  'ri-route-line': 'mgc_route_line',
  'ri-subway-line': 'mgc_train_line',
  'ri-walk-line': 'mgc_walk_line',
  'ri-share-forward-line': 'mgc_share_forward_line',
  'ri-phone-line': 'mgc_phone_line',
  'ri-draggable': 'mgc_dots_line',
  'ri-hand-coin-line': 'mgc_coin_line'
};

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.wxml') || fullPath.endsWith('.js') || fullPath.endsWith('.wxss')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [remix, mingcute] of Object.entries(map)) {
        const regex = new RegExp(remix, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, mingcute);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory('./pages');
processDirectory('./utils');
processDirectory('./components'); // if exists
