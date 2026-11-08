targetScope = 'resourceGroup'

param appName string
param identityLocation string
param roleDefinitionId string

resource app 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: appName
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'retiregolden-swa-preview-cleanup'
  location: identityLocation
}

resource github 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: identity
  name: 'github-azure-preview-cleanup'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:RetireGolden/RetireGolden:environment:azure-preview-cleanup'
    audiences: ['api://AzureADTokenExchange']
  }
}

resource grant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: app
  name: guid(app.id, identity.id, roleDefinitionId)
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output clientId string = identity.properties.clientId
output principalId string = identity.properties.principalId
