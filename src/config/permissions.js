/**
 * Permission Configuration
 *
 * Defines role-based permissions for the nachtschall-map application.
 * Permissions control access to interactive features based on user role.
 */

/**
 * Permission structure defining all available permissions
 */
export const DEFAULT_PERMISSIONS = {
  fog: {
    reveal: false,  // Can reveal fog (click/drag)
    add: false      // Can add fog (right-click/drag)
  },
  markers: {
    add: false,     // Can add markers (double-click)
    edit: false,    // Can edit marker names
    move: false,    // Can drag markers
    remove: false   // Can remove markers
  },
  drawings: {
    create: false   // Can draw paths
  },
  initiative: {
    assign: false,  // Can drag markers to rounds
    manage: false   // Can add/remove rounds, reset
  },
  mapControls: {
    tools: false,       // Can toggle draw tool, initiative tracker
    reset: false,       // Can reset map
    colorPicker: false  // Can access color picker
  },
  ping: {
    send: false     // Can send pings on map
  }
}

/**
 * Role-based permission presets
 */
export const ROLE_PRESETS = {
  /**
   * Owner - Full access to all features
   */
  owner: {
    fog: {
      reveal: true,
      add: true
    },
    markers: {
      add: true,
      edit: true,
      move: true,
      remove: true
    },
    drawings: {
      create: true
    },
    initiative: {
      assign: true,
      manage: true
    },
    mapControls: {
      tools: true,
      reset: true,
      colorPicker: true
    },
    ping: {
      send: true
    }
  },

  /**
   * Viewer - Read-only access (zoom/pan only)
   */
  viewer: {
    fog: {
      reveal: false,
      add: false
    },
    markers: {
      add: false,
      edit: false,
      move: false,
      remove: false
    },
    drawings: {
      create: false
    },
    initiative: {
      assign: false,
      manage: false
    },
    mapControls: {
      tools: false,
      reset: false,
      colorPicker: false
    },
    ping: {
      send: false
    }
  },

  /**
   * Player - Color picker access only (for future features)
   */
  player: {
    fog: {
      reveal: false,
      add: false
    },
    markers: {
      add: false,
      edit: false,
      move: false,
      remove: false
    },
    drawings: {
      create: false
    },
    initiative: {
      assign: false,
      manage: false
    },
    mapControls: {
      tools: false,
      reset: false,
      colorPicker: true
    },
    ping: {
      send: true
    }
  }
}

/**
 * Get permissions for a specific role
 * @param {string} role - Role name ('owner', 'viewer', 'player')
 * @returns {object} Permission object for the role
 */
export function getRolePermissions(role) {
  return ROLE_PRESETS[role] || ROLE_PRESETS.viewer
}
