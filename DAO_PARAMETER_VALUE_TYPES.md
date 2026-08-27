# DAO parameter value types

`Shown in web-client-v2` is `Yes` when the parameter is in the frontend catalog and its path exists in the current server configuration, allowing the Add Proposal form to render it.

## Governance

| Parameter | Shown in web-client-v2 | web-client-v2 value type | Server value type |
| --- | --- | --- | --- |
| `claimDuration` | Yes | `number` | `number` |
| `graceDuration` | Yes | `number` | `number` |
| `minimumSpendUsdStr` | Yes | `string` | `string` |
| `pctBurned` | Yes | `number` | `number` |
| `proposalFeeUsdStr` | Yes | `string` | `string` |
| `reviewDuration` | Yes | `number` | `number` |
| `voteExponent` | Yes | `number` | `number` |
| `voteThresholdUsdStr` | Yes | `string` | `string` |
| `votingDuration` | Yes | `number` | `number` |

## Economic

| Parameter | Shown in web-client-v2 | web-client-v2 value type | Server value type |
| --- | --- | --- | --- |
| `certCycleDuration` | Yes | `number` | `number` |
| `enableNodeSlashing` | Yes | `boolean` | `boolean` |
| `maintenanceInterval` | Yes | `number` | `number` |
| `messageMaxLength` | Yes | `number` | `number` |
| `messageRetentionDays` | Yes | `number` | `number` |
| `nodeRewardInterval` | Yes | `number` | `number` |
| `restakeCooldown` | Yes | `number` | `number` |
| `enableLeftNetworkEarlySlashing` | Yes | `boolean` | `boolean` |
| `enableNodeRefutedSlashing` | Yes | `boolean` | `boolean` |
| `enableSyncTimeoutSlashing` | Yes | `boolean` | `boolean` |
| `leftNetworkEarlyPenaltyPercent` | Yes | `number` | `number` |
| `nodeRefutedPenaltyPercent` | Yes | `number` | `number` |
| `syncTimeoutPenaltyPercent` | Yes | `number` | `number` |
| `stabilityScaleDiv` | Yes | `number` | `number` |
| `stabilityScaleMul` | Yes | `number` | `number` |
| `stakeLockTime` | Yes | `number` | `number` |
| `tollNetworkTaxPercent` | Yes | `number` | `number` |
| `tollTimeout` | Yes | `number` | `number` |
| `txPause` | Yes | `boolean` | `boolean` |

## Protocol

| Parameter | Shown in web-client-v2 | web-client-v2 value type | Server value type |
| --- | --- | --- | --- |
| `minNodes` | Yes | `number` | `number` |
| `maxNodes` | Yes | `number` | `number` |
| `baselineNodes` | Yes | `number` | `number` |
| `cycleDuration` | Yes | `number` | `number` |
| `allowEndUserTxnInjections` | No | `boolean` | Not present |
| `amountToGrow` | Yes | `number` | `number` |
| `amountToShrink` | Yes | `number` | `number` |
| `maxJoinedPerCycle` | Yes | `number` | `number` |
| `maxDesiredMultiplier` | Yes | `number` | `number` |
| `maxShrinkMultiplier` | Yes | `number` | `number` |
| `syncBoostEnabled` | Yes | `boolean` | `boolean` |
| `limitRate` | Yes | `boolean` | `boolean` |
| `nodesPerConsensusGroup` | Yes | `number` | `number` |
| `voterPercentage` | Yes | `number` | `number` |
