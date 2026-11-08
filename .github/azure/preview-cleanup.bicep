targetScope = 'subscription'

@description('Resource group containing the existing RetireGolden Static Web App.')
@allowed(['RetireGolden_group'])
param resourceGroupName string = 'RetireGolden_group'

@allowed(['RetireGoldenApp'])
param appName string = 'RetireGoldenApp'

param identityLocation string = 'centralus'

var groupId = subscriptionResourceId('Microsoft.Resources/resourceGroups', resourceGroupName)

// Assignability is limited to this group; the actual grant below is only on the app.
resource cleanupRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(groupId, appName, 'verified-preview-cleanup')
  properties: {
    roleName: 'RetireGolden SWA Preview Cleanup'
    description: 'Read and delete build environments of the assigned Static Web App.'
    type: 'CustomRole'
    assignableScopes: [groupId]
    permissions: [
      {
        actions: [
          'Microsoft.Web/staticSites/builds/Read'
          'Microsoft.Web/staticSites/builds/Delete'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
  }
}

module identity './preview-cleanup-identity.bicep' = {
  name: 'retiregolden-preview-cleanup-identity'
  scope: resourceGroup(resourceGroupName)
  params: {
    appName: appName
    identityLocation: identityLocation
    roleDefinitionId: cleanupRole.id
  }
}

output clientId string = identity.outputs.clientId
output principalId string = identity.outputs.principalId
output tenantId string = tenant().tenantId
output subscriptionId string = subscription().subscriptionId
output roleDefinitionId string = cleanupRole.id
