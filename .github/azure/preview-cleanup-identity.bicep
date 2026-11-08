targetScope = 'resourceGroup'

param appName string
param identityLocation string
param roleDefinitionId string

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

// A separate deployment resolves the new identity's principal before naming its grant.
module grant './preview-cleanup-grant.bicep' = {
  name: 'retiregolden-preview-cleanup-grant'
  params: {
    appName: appName
    roleDefinitionId: roleDefinitionId
    principalId: identity.properties.principalId
  }
}

output clientId string = identity.properties.clientId
output principalId string = identity.properties.principalId
