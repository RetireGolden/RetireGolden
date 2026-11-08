targetScope = 'resourceGroup'

param appName string
param roleDefinitionId string
param principalId string

resource app 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: appName
}

resource grant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: app
  name: guid(app.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
