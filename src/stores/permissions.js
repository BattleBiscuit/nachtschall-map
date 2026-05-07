/**
 * Permissions Store
 *
 * Manages role-based permissions for map interactions
 */

import { defineStore } from 'pinia'
import { getRolePermissions, DEFAULT_PERMISSIONS } from '@/config/permissions'

export const usePermissionsStore = defineStore('permissions', {
  state: () => ({
    // Current user's permissions
    permissions: { ...DEFAULT_PERMISSIONS },

    // Current role
    currentRole: 'viewer'
  }),

  getters: {
    /**
     * Check if user can perform a specific action
     * @param {string} category - Permission category (e.g., 'fog', 'markers')
     * @param {string} action - Specific action (e.g., 'reveal', 'add')
     * @returns {boolean} True if action is permitted
     */
    canPerformAction: (state) => (category, action) => {
      return state.permissions[category]?.[action] || false
    },

    /**
     * Check if user has any permissions in a category
     * @param {string} category - Permission category
     * @returns {boolean} True if any action in category is permitted
     */
    hasAnyPermissionIn: (state) => (category) => {
      const categoryPerms = state.permissions[category]
      if (!categoryPerms) return false

      return Object.values(categoryPerms).some(perm => perm === true)
    }
  },

  actions: {
    /**
     * Load permissions based on role
     * @param {string} role - Role name ('owner', 'viewer', 'player')
     */
    loadPermissions(role) {
      this.currentRole = role
      this.permissions = getRolePermissions(role)
      console.log(`[Permissions] Loaded ${role} permissions`, this.permissions)
    },

    /**
     * Reset permissions to default (viewer)
     */
    resetPermissions() {
      this.loadPermissions('viewer')
    }
  }
})
