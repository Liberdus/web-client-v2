# Plan: Display Skeleton Loader for Pending Stake/Unstake Transactions in Validator Modal

## Goal

[ ] Modify the `openValidatorModal` function and the Validator Modal UI to display a skeleton loader when a 'stake' (`deposit_stake`) or 'unstake' (`withdraw_stake`) transaction is pending in `myData.pending`.

## Files to be Modified

- [ ] `index.html`: To add the new skeleton loader elements.
- [ ] `app.js`: To implement the logic in `openValidatorModal`.
- [ ] `styles.css`: To add styles for the skeleton loader.

## Detailed Steps

### 1. Update `index.html` (Validator Modal Section)

- [ ] **Add a new container for the pending transaction skeleton loader** within the `validatorModal`'s `modal-content`. This container will be hidden by default.
- [ ] Inside this container, add placeholder elements that will be styled as a skeleton loader. This could represent the areas that would normally show stake/unstake information.

  **Proposed HTML structure (to be added inside `<div class="modal-content">` within `<div class="modal fixed-header" id="validatorModal">`):**

  ```html
  <!-- Pending Stake/Unstake Skeleton Loader -->
  <div id="validator-pending-tx-skeleton" style="display: none; padding: 1rem;">
    <h4>Processing Transaction...</h4>
    <div
      class="skeleton-item"
      style="height: 20px; width: 70%; margin-bottom: 10px; background-color: #e0e0e0;"
    ></div>
    <div
      class="skeleton-item"
      style="height: 20px; width: 50%; margin-bottom: 10px; background-color: #e0e0e0;"
    ></div>
    <div
      class="skeleton-item"
      style="height: 40px; width: 100%; background-color: #e0e0e0; margin-top: 20px;"
    ></div>
    <!-- Add more skeleton elements as needed to mimic the layout of stake/unstake info -->
  </div>
  ```

  _Placement Note:_ This should ideally be placed before or alongside `validator-loading`, `validator-error-message`, and `validator-details` divs, allowing JavaScript to manage which one is visible.

### 2. Modify `app.js` (`openValidatorModal` function)

- [ ] **Check for Pending Transactions:**

  - [ ] At the beginning of `openValidatorModal`, before fetching validator details, iterate through `myData.pending`.
  - [ ] Look for transactions where (`tx.type === 'deposit_stake'` OR `tx.type === 'withdraw_stake'`). The `myData.pending` array typically holds transactions that are actively being tracked and not yet confirmed or failed.

- [ ] **Control UI Visibility:**

  - [ ] Get references to:
    - `validator-pending-tx-skeleton` (the new skeleton loader).
    - `validator-loading` (existing loading spinner).
    - `validator-error-message` (existing error display).
    - `validator-details` (existing validator details container).
    - Stake/Unstake buttons (`openStakeModal`, `submitUnstake`).
  - [ ] **If a pending stake/unstake transaction is found in `myData.pending`:**
    - [ ] Show `validator-pending-tx-skeleton`.
    - [ ] Hide `validator-loading`, `validator-error-message`, and `validator-details`.
    - [ ] Disable stake and unstake buttons.
    - [ ] The function might then skip the data fetching part for validator details for this particular modal opening.
  - [ ] **If no pending stake/unstake transaction is found in `myData.pending`:**
    - [ ] Hide `validator-pending-tx-skeleton`.
    - [ ] Proceed with the existing logic: show `validator-loading`, fetch data, then show `validator-details` or `validator-error-message` and manage button states as usual.

- [ ] **Logic Refinement:**
  - [ ] The check for pending transactions should be performed early in the function.
  - [ ] Ensure robust handling if `myData.pending` is not initialized or is empty.

### 3. Update `styles.css`

- [ ] **Add styles for `validator-pending-tx-skeleton` and `.skeleton-item`:**

  - [ ] Basic styling for the skeleton items (background color, height, margins).
  - [ ] Add a shimmer/pulse animation to the skeleton items to indicate loading.

  ```css
  /* Example Skeleton Styles */
  #validator-pending-tx-skeleton h4 {
    color: #333; /* Or your app's standard text color */
    margin-bottom: 15px;
    text-align: center; /* Or as per your design */
  }

  .skeleton-item {
    background-color: #e0e0e0; /* Light grey for skeleton */
    border-radius: 4px;
    animation: pulse 1.5s infinite ease-in-out;
    margin-left: auto; /* Example for centering if needed */
    margin-right: auto; /* Example for centering if needed */
  }

  @keyframes pulse {
    0% {
      background-color: #e0e0e0;
    }
    50% {
      background-color: #d0d0d0;
    } /* Slightly darker for pulse effect */
    100% {
      background-color: #e0e0e0;
    }
  }

  /* Default state if JS doesn't hide it properly (though inline style is primary) */
  /* #validator-pending-tx-skeleton {
      display: none;
  } */
  ```

## Considerations

- **Transaction Source:** `myData.pending` is the correct source for transactions that have been submitted to the network and are awaiting confirmation. The `checkPendingTransactions` function processes this array.
- **User Experience:** The skeleton loader should clearly communicate that an existing stake/unstake operation is in progress.
- **Single Pending Focus:** For this task, we assume that if a relevant pending transaction is found, it's the primary focus, and other validator details don't need to be loaded/displayed simultaneously.
- **Clearing the Skeleton:** The skeleton loader visibility will be re-evaluated each time `openValidatorModal` is called. If the transaction is no longer in `myData.pending` (because it completed or failed and was removed by `checkPendingTransactions`), the skeleton will not be shown on subsequent modal openings.
