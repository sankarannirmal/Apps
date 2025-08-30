// Global state for the match
let matchSettings = {};
let currentInningsNumber = 0;

// Run loadState() when the script is first loaded to check for a saved game.
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    // Attach all primary event listeners once.
    document.getElementById('force-restart-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to start a new match? All current progress will be lost.')) {
            restartMatch();
        }
    });
    document.getElementById('restart-match-btn').addEventListener('click', restartMatch);

    // Add a single, persistent event listener to the scorecards wrapper
    const scorecardsWrapper = document.getElementById('scorecards-wrapper');
    scorecardsWrapper.addEventListener('change', handleMatchEvent);
    scorecardsWrapper.addEventListener('click', handleMatchClickEvent);
});


document.getElementById('match-setup-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const numPlayers = parseInt(document.getElementById('num-players').value, 10);

    if (isNaN(numPlayers) || numPlayers <= 0) {
        alert('Please enter a valid number of players.');
        return;
    }

    // Get existing player names before clearing the list to preserve them
    const existingPlayers = getPlayersFromDOM();

    // 1. Generate Player List Tables
    const playerListWrapper = document.getElementById('player-lists-wrapper');
    playerListWrapper.innerHTML = ''; // Clear previous lists
    // Pass existing names to the generator function
    generatePlayerListTable(playerListWrapper, 'Team A', numPlayers, existingPlayers['Team A']);
    generatePlayerListTable(playerListWrapper, 'Team B', numPlayers, existingPlayers['Team B']);
    playerListWrapper.classList.remove('hidden');
    
    // 2. Show the "Start Match" button and hide old scorecards
    document.getElementById('start-match-container').classList.remove('hidden');
    document.getElementById('match-setup-form').parentElement.classList.add('hidden'); // Hide setup form
    document.getElementById('scorecards-wrapper').classList.add('hidden');
});

document.getElementById('start-match-btn').addEventListener('click', function() {
    // Populate matchSettings from the form
    matchSettings.numOvers = parseInt(document.getElementById('num-overs').value, 10);
    matchSettings.numPlayers = parseInt(document.getElementById('num-players').value, 10);
    matchSettings.firstInningsBattingTeam = document.getElementById('batting-first').value;
    currentInningsNumber = 1;

    if (isNaN(matchSettings.numOvers) || matchSettings.numOvers <= 0) {
        alert('Please enter a valid number of overs.');
        return;
    }

    const allPlayers = getPlayersFromDOM();
    matchSettings.players = allPlayers; // Store player lists for summary
    const firstInningsBowlingTeam = (matchSettings.firstInningsBattingTeam === 'Team A') ? 'Team B' : 'Team A';
    const battingTeamPlayers = allPlayers[matchSettings.firstInningsBattingTeam];
    const bowlingTeamPlayers = allPlayers[firstInningsBowlingTeam];
    
    startInnings(matchSettings.firstInningsBattingTeam, firstInningsBowlingTeam, battingTeamPlayers, bowlingTeamPlayers, matchSettings.numOvers);
    
    // Hide the setup buttons
    document.getElementById('start-match-container').classList.add('hidden');
    document.getElementById('player-lists-wrapper').classList.add('hidden');
    saveState(); // Save state after starting the match

});

document.getElementById('start-second-innings-btn').addEventListener('click', function() {
    // Hide this button
    this.parentElement.classList.add('hidden');

    const summaryContainer = document.getElementById('first-innings-summary');
    const scorecardsWrapper = document.getElementById('scorecards-wrapper');

    // **CRITICAL FIX**: Before copying, programmatically set the 'selected' attribute
    // on the currently selected option for all dropdowns. This ensures the
    // copied HTML reflects the final state of the innings.
    scorecardsWrapper.querySelectorAll('select').forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            // First, remove 'selected' from any other option to be safe
            Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
            selectedOption.setAttribute('selected', 'selected');
        }
    });

    // Capture score and create a static HTML copy of the first innings scorecard
    const firstInningsRuns = scorecardsWrapper.querySelector('#bowling-grand-total').textContent;
    const firstInningsWickets = scorecardsWrapper.querySelector('#bowling-total-wickets').textContent;
    matchSettings.firstInningsScore = parseInt(firstInningsRuns, 10);
    matchSettings.firstInningsWickets = parseInt(firstInningsWickets, 10);
    matchSettings.targetScore = matchSettings.firstInningsScore + 1;
    let firstInningsHTML = scorecardsWrapper.innerHTML;

    // **CRITICAL FIX**: Sanitize the copied HTML to remove all 'id' and 'name' attributes, preventing conflicts.
    firstInningsHTML = firstInningsHTML.replace(/ id="[^"]*"/g, '');
    firstInningsHTML = firstInningsHTML.replace(/ name="[^"]*"/g, '');

    // Populate the summary container with the static, ID-less copy. The inputs are already disabled.
    summaryContainer.innerHTML = `<h2>1st Innings Scorecard</h2>${firstInningsHTML}`;
    summaryContainer.classList.remove('hidden');

    // Now that the copy is made, we can safely clear the original wrapper for the 2nd innings
    scorecardsWrapper.innerHTML = '';

    // Set state for the new innings
    currentInningsNumber = 2;

    // Swap teams for the second innings
    const secondInningsBattingTeam = (matchSettings.firstInningsBattingTeam === 'Team A') ? 'Team B' : 'Team A';
    const secondInningsBowlingTeam = matchSettings.firstInningsBattingTeam;

    // Get players for the new innings
    const allPlayers = matchSettings.players;
    const battingTeamPlayers = allPlayers[secondInningsBattingTeam];
    const bowlingTeamPlayers = allPlayers[secondInningsBowlingTeam];

    // Start the new innings in the now-empty scorecardsWrapper
    startInnings(secondInningsBattingTeam, secondInningsBowlingTeam, battingTeamPlayers, bowlingTeamPlayers, matchSettings.numOvers);
    saveState(); // Save state after starting the second innings
});

function startInnings(battingTeamName, bowlingTeamName, battingTeamPlayers, bowlingTeamPlayers, numOvers) {
    matchSettings.currentBattingTeam = battingTeamName;
    const wrapper = document.getElementById('scorecards-wrapper');
    wrapper.innerHTML = ''; // Clear previous scorecards

    const bowlingSection = document.createElement('div');
    bowlingSection.className = 'team-section';
    bowlingSection.innerHTML = `
        <h2>${bowlingTeamName} - Bowling</h2>
        <div class="scorecard-box" id="bowling-card-container"></div>
    `;
    wrapper.appendChild(bowlingSection);
    generateBowlingScorecard(document.getElementById('bowling-card-container'), numOvers, bowlingTeamPlayers);

    const battingSection = document.createElement('div');
    battingSection.className = 'team-section';
    battingSection.innerHTML = `
        <h2>${battingTeamName} - Batting</h2>
        <div class="scorecard-box" id="batting-card-container"></div>
    `;
    wrapper.appendChild(battingSection);
    generateBattingScorecard(document.getElementById('batting-card-container'), battingTeamPlayers);

    // If it's the second innings, add the target display
    if (currentInningsNumber === 2) {
        const targetEl = document.createElement('div');
        targetEl.className = 'target-display';
        targetEl.textContent = `Target: ${matchSettings.targetScore}`;
        bowlingSection.prepend(targetEl);
    }

    // Show the main scorecards and the new live scoring section
    wrapper.classList.remove('hidden');
    document.getElementById('force-restart-btn').classList.remove('hidden');
}

function generatePlayerListTable(container, teamName, playerCount, existingNames = []) {
    const teamSection = document.createElement('div');
    teamSection.className = 'team-section'; // Reuse existing class for consistency
    teamSection.id = `player-list-${teamName.replace(' ', '-')}`; // Add a unique ID

    // Create the inner HTML for the player list table
    let tableRows = '';
    for (let i = 1; i <= playerCount; i++) {
        // Use the existing name if available, otherwise use a default placeholder
        const playerName = existingNames[i - 1] || `Player ${i}`;
        tableRows += `
            <tr>
                <td><input type="text" class="player-name-input" value="${playerName}" aria-label="${teamName} Player ${i} name"></td>
            </tr>
        `;
    }

    teamSection.innerHTML = `
        <h2>${teamName} - Player List</h2>
        <div class="scorecard-box">
            <table>
                <thead>
                    <tr>
                        <th>Player Name</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>`;
    container.appendChild(teamSection);
}

// New function to get player names from the generated player list tables
function getPlayersFromDOM() {
    const teamAPlayers = [];
    const teamBPlayers = [];

    // Get player names for Team A using its unique ID
    const teamAInputs = document.querySelectorAll('#player-list-Team-A .player-name-input');
    teamAInputs.forEach(input => {
        teamAPlayers.push(input.value.trim());
    });

    // Get player names for Team B using its unique ID
    const teamBInputs = document.querySelectorAll('#player-list-Team-B .player-name-input');
    teamBInputs.forEach(input => {
        teamBPlayers.push(input.value.trim());
    });

    return { 'Team A': teamAPlayers, 'Team B': teamBPlayers };
}

function generateBattingScorecard(container, battingTeamPlayers) {
    container.innerHTML = ''; // Clear previous table

    const table = document.createElement('table');
    table.classList.add('batting-table'); // Use a class instead of an ID for easier querying
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['On Strike', 'Batsman', 'Status', 'Runs', 'Balls', '4s', '6s', 'SR'];
    headerRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
    thead.appendChild(headerRow);

    table.appendChild(thead);
    table.appendChild(tbody);

    // Add a footer for the batting total
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr>
            <td colspan="7" class="total-label">Extras</td>
            <td id="batting-extras-total" class="grand-total">0</td>
        </tr>
        <tr>
            <td colspan="7" class="total-label">Total</td>
            <td id="batting-total-score" class="grand-total">0/0</td>
        </tr>
    `;
    table.appendChild(tfoot);
    container.appendChild(table);

    // Add the two opening batsman rows
    addNewBatsmanRow(tbody, battingTeamPlayers);
    addNewBatsmanRow(tbody, battingTeamPlayers);
}

/**
 * Adds a new, empty batsman row to the batting scorecard.
 * @param {HTMLTableSectionElement} tbody The tbody of the batting table.
 * @param {string[]} allPlayers The full list of players for the batting team.
 */
function addNewBatsmanRow(tbody, allPlayers) {
    const newRow = tbody.insertRow();
    const rowId = `batsman-row-${currentInningsNumber}-${tbody.rows.length}`;
    newRow.id = rowId;

    // Get players already selected to filter them out of the new dropdown
    const selectedPlayers = Array.from(tbody.querySelectorAll('.batsman-select')).map(s => s.value);
    const availablePlayers = allPlayers.filter(p => !selectedPlayers.includes(p));

    const playerOptions = availablePlayers.map(p => `<option value="${p}">${p}</option>`).join('');

    newRow.innerHTML = `
        <td class="on-strike-cell"><input type="radio" name="on-strike" class="on-strike-radio" value="${rowId}" disabled></td>
        <td class="batsman-name-cell">
            <select class="batsman-select">
                <option value="">Select Batsman</option>
                ${playerOptions}
            </select>
        </td>
        <td class="batsman-status-cell">
            <select class="batsman-status-select">
                <option value="Not out" selected>Not out</option>
                <option value="Out">Out</option>
            </select>
        </td>
        <td class="batsman-runs">0</td>
        <td class="batsman-balls">0</td>
        <td class="batsman-fours">0</td>
        <td class="batsman-sixes">0</td>
        <td class="batsman-sr">0.00</td>
    `;
    return newRow;
}

function generateBowlingScorecard(container, overCount, bowlingTeamPlayers) { // Added bowlingTeamPlayers parameter
    container.innerHTML = ''; // Clear previous table

    const table = document.createElement('table');
    table.classList.add('bowling-table'); // Use a class instead of an ID for easier querying
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header for the new over-based layout
    const headerRow = document.createElement('tr');
    const headers = ['Over', 'Bowler', '1', '2', '3', '4', '5', '6', 'Runs', 'Wickets', 'Extras', 'Actions'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        if (headerText === 'Bowler') {
            th.classList.add('bowler-column');
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create a row for each over
    for (let i = 1; i <= overCount; i++) {
        const overRow = document.createElement('tr');
        overRow.id = `over-row-${currentInningsNumber}-${i}`; // Add a unique ID for the over's main row
        
        // Over Number Cell
        const overNumCell = document.createElement('td');
        overNumCell.textContent = i;
        overRow.appendChild(overNumCell);

        // Bowler Select Cell
        const bowlerSelectTd = document.createElement('td');
        bowlerSelectTd.classList.add('bowler-column');
        const bowlerSelect = document.createElement('select');
        bowlerSelect.className = 'bowler-select'; // Add a class for styling/identification
        bowlerSelect.setAttribute('aria-label', `Bowler for over ${i}`);

        // Add a default "Select Bowler" option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Bowler';
        bowlerSelect.appendChild(defaultOption);

        // Populate with bowling team players
        bowlingTeamPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            bowlerSelect.appendChild(option);
        });
        bowlerSelectTd.appendChild(bowlerSelect);
        overRow.appendChild(bowlerSelectTd);

        // Ball Select Cells (6 of them)
        for (let j = 1; j <= 6; j++) {
            const ballCell = document.createElement('td');
            ballCell.classList.add('ball-cell');
            ballCell.appendChild(createBallSelectElement(`Over ${i} Ball ${j}`));
            overRow.appendChild(ballCell);
        }

        // Over Runs Total Cell
        const overRunsCell = document.createElement('td');
        overRunsCell.className = 'over-runs';
        overRunsCell.textContent = '0';
        overRow.appendChild(overRunsCell);

        // Over Wickets Total Cell (This was missing)
        const overWicketsCell = document.createElement('td');
        overWicketsCell.className = 'over-wickets';
        overWicketsCell.textContent = '0';
        overRow.appendChild(overWicketsCell);

        const overExtrasCell = document.createElement('td');
        overExtrasCell.className = 'over-extras';
        overExtrasCell.textContent = '0';
        overRow.appendChild(overExtrasCell);

        // Actions Cell (for restart button)
        const actionsCell = document.createElement('td');
        actionsCell.className = 'over-actions';
        actionsCell.innerHTML = `<button type="button" class="restart-over-btn" data-over-id="${overRow.id}" title="Restart this over">Restart</button>`;
        overRow.appendChild(actionsCell);

        tbody.appendChild(overRow);
    }

    table.appendChild(thead);
    table.appendChild(tbody);

    // Create table footer for the innings total
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr>
            <td colspan="8" class="total-label">Total</td>
            <td id="bowling-grand-total" class="grand-total">0</td>
            <td id="bowling-total-wickets" class="grand-total">0</td>
            <td id="bowling-total-extras" class="grand-total">0</td>
            <td></td> <!-- Placeholder for Actions column -->
        </tr>
    `;
    table.appendChild(tfoot);

    container.appendChild(table);
}

/**
 * Creates a standardized <select> element for ball-by-ball entries.
 * @param {string} ariaLabel The accessibility label for the select element.
 * @returns {HTMLSelectElement} The created select element.
 */
function createBallSelectElement(ariaLabel) {
    const select = document.createElement('select');
    select.className = 'ball-select';
    select.setAttribute('aria-label', ariaLabel);

    const options = ['', '0', '1', '2', '3', '4', '5', '6', 'Wd', 'Nb', 'W', 'RO'];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    return select;
}

/**
 * Creates a <select> element for entering runs on an extra delivery.
 * @returns {HTMLSelectElement} The created select element for runs.
 */
function createRunsOnExtraSelect() {
    const select = document.createElement('select');
    select.className = 'split-ball-runs-select';
    const options = ['0', '1', '2', '3', '4', '5', '6', 'W'];
    // Add a blank default option to prompt user selection
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-';
    select.appendChild(defaultOption);

    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    return select;
}

/**
 * Replaces a standard ball cell with the split view for extras.
 * @param {HTMLTableCellElement} cell The table cell to modify.
 * @param {string} eventType The type of event ('Wd', 'Nb', 'W', 'RO').
 */
function createSplitBallView(cell, eventType) {
    if (cell.dataset.isSplit) return; // Prevent this from running twice on the same cell

    cell.dataset.isSplit = 'true';
    cell.dataset.eventType = eventType;
    cell.innerHTML = ''; // Clear the old select dropdown

    const containerDiv = document.createElement('div');
    containerDiv.className = 'split-ball-container';

    const eventSelect = document.createElement('select');
    eventSelect.className = 'split-ball-event-select';
    eventSelect.title = 'Change event type or clear';
    eventSelect.innerHTML = `<option value="${eventType}" selected>${eventType}</option><option value="">Clear</option>`;

    containerDiv.appendChild(eventSelect);
    containerDiv.appendChild(createRunsOnExtraSelect());
    cell.appendChild(containerDiv);
}

/**
 * Handles all CLICK events on the scorecards using event delegation.
 * This is separate from handleMatchEvent which handles 'change' events.
 * @param {Event} e The click event object.
 */
function handleMatchClickEvent(e) {
    const target = e.target;
    const wrapper = document.getElementById('scorecards-wrapper');

    if (target.classList.contains('restart-over-btn')) {
        e.preventDefault();
        if (!confirm('Are you sure you want to restart this over? All entries for this over will be cleared and stats will be reverted.')) {
            return;
        }

        const overId = target.dataset.overId;
        const mainOverRow = document.getElementById(overId);
        if (!mainOverRow) return;

        const table = mainOverRow.closest('table');
        const allRowsForOver = [mainOverRow, ...table.querySelectorAll(`tr[data-over-row="${overId}"]`)];
        const allBallCells = [];
        allRowsForOver.forEach(r => allBallCells.push(...r.querySelectorAll('.ball-cell')));

        let wicketReversed = false;

        // Loop through all ball cells and revert them
        allBallCells.forEach(cell => {
            // --- WICKET REVERSAL LOGIC (from reset-ball-cell) ---
            const wicketBatsmanId = cell.dataset.wicketBatsmanId;
            const newBatsmanRowId = cell.dataset.newBatsmanRowId;

            if (wicketBatsmanId) {
                wicketReversed = true;
                const batsmanRow = document.getElementById(wicketBatsmanId);
                if (batsmanRow) {
                    batsmanRow.querySelector('.batsman-status-select').value = 'Not out';
                    batsmanRow.querySelector('.batsman-status-select').disabled = false;
                    batsmanRow.querySelector('.batsman-select').disabled = false;
                    const radio = batsmanRow.querySelector('.on-strike-radio');
                    if (radio && batsmanRow.querySelector('.batsman-select').value) {
                        radio.disabled = false;
                    }
                }
            }

            if (newBatsmanRowId) {
                const newRow = document.getElementById(newBatsmanRowId);
                if (newRow) newRow.remove();
            }

            // --- EXTRA BALL REMOVAL LOGIC (from reset-ball-cell) ---
            // This is important to handle Wd/Nb within the over being reset
            const addedExtraId = cell.dataset.addedExtraId;
            if (addedExtraId) {
                const extraCellToRemove = document.getElementById(addedExtraId);
                if (extraCellToRemove) {
                    const parentRow = extraCellToRemove.closest('tr');
                    extraCellToRemove.remove();
                    if (parentRow.classList.contains('extra-over-row') && parentRow.querySelectorAll('.ball-cell').length === 0) {
                        parentRow.remove();
                    } else if (parentRow.classList.contains('extra-over-row')) {
                        const placeholderCell = parentRow.querySelector('td[colspan]:last-child');
                        if (placeholderCell) placeholderCell.colSpan += 1;
                    }
                }
            }

            // --- RESET THE CELL ---
            cell.innerHTML = '';
            cell.appendChild(createBallSelectElement('Ball entry'));
            // Clear all data attributes
            Object.keys(cell.dataset).forEach(key => delete cell.dataset[key]);
        });

        // --- RUN OUT FLOW CANCELLATION ---
        // If the "who is out?" flow was active and triggered by a ball in this over, cancel it.
        if (wrapper && wrapper.dataset.runOutCellId) {
            const runOutCell = document.getElementById(wrapper.dataset.runOutCellId);
            if (runOutCell && allBallCells.includes(runOutCell)) {
                delete wrapper.dataset.runOutCellId;
                wrapper.querySelectorAll('.run-out-candidate').forEach(el => {
                    el.classList.remove('run-out-candidate');
                });
            }
        }

        // If any wickets were reversed, update the master count before full recalc
        if (wicketReversed) {
            updateWicketCountAndTotals();
        }

        // Trigger a full recalculation using the first ball cell of the over as a reference
        recalculateAllStats(mainOverRow.querySelector('.ball-cell'));

        alert(`Over ${mainOverRow.cells[0].textContent} has been restarted.`);
    }
}

/**
 * Handles all 'change' events on the scorecards using event delegation.
 * @param {Event} e The input event object.
 */
function handleMatchEvent(e) {
    const wrapper = document.getElementById('scorecards-wrapper');
    // Check if the input came from a ball-input field
    const target = e.target;

    if (target.classList.contains('ball-select')) {
        const value = target.value;
        const cell = target.closest('.ball-cell');

        if (value === 'RO') {
            // For a Run Out, create the split view to select runs.
            // The "who is out" part will be handled after runs are selected.
            createSplitBallView(cell, value);
            saveState(); // Save the split view state
            return; // Stop here. The next action is selecting runs.
        } else if (['Nb', 'Wd'].includes(value)) {
            // Add extra ball for Nb/Wd BEFORE destroying the original select
            if (!cell.dataset.extraAdded) {
                const extraBallCell = addExtraBall(target);
                if (extraBallCell) {
                    // Give the new cell a unique ID so we can find it later for removal
                    const uniqueId = `extra-cell-${Date.now()}`;
                    extraBallCell.id = uniqueId;
                    // Store this ID on the original cell that created it
                    cell.dataset.addedExtraId = uniqueId;
                }
                cell.dataset.extraAdded = 'true'; // Use cell dataset, as target is destroyed
            }
            createSplitBallView(cell, value);
            // Update bowling stats immediately to reflect the 1 run for the extra
            updateBowlingStats(cell.querySelector('.split-ball-runs-select'));
            saveState(); // Save the split view state
        } else {
            // This is a regular delivery (0-6 runs or a simple wicket)
            // An edit or new entry requires a full recalculation for accuracy.
            recalculateAllStats(target);
        }
    } else if (target.classList.contains('split-ball-event-select')) {
        if (target.value === '') {
            // This is the "Clear" action, replacing the old [x] link.
            if (!confirm('Are you sure you want to clear this ball?')) {
                // If user cancels, revert the dropdown to its original state.
                target.value = target.closest('.ball-cell').dataset.eventType;
                return;
            }

            const cell = target.closest('.ball-cell');

            // --- WICKET REVERSAL LOGIC ---
            const wicketBatsmanId = cell.dataset.wicketBatsmanId;
            const newBatsmanRowId = cell.dataset.newBatsmanRowId;

            if (wicketBatsmanId) {
                const batsmanRow = document.getElementById(wicketBatsmanId);
                if (batsmanRow) {
                    batsmanRow.querySelector('.batsman-status-select').value = 'Not out';
                    batsmanRow.querySelector('.batsman-status-select').disabled = false;
                    batsmanRow.querySelector('.batsman-select').disabled = false;
                    const radio = batsmanRow.querySelector('.on-strike-radio');
                    if (radio && batsmanRow.querySelector('.batsman-select').value) {
                        radio.disabled = false;
                    }
                }
            }
            if (newBatsmanRowId) {
                const newRow = document.getElementById(newBatsmanRowId);
                if (newRow) newRow.remove();
            }

            // --- RUN OUT FLOW CANCELLATION ---
            // If the "who is out?" flow was active, cancel it before proceeding.
            if (wrapper.dataset.runOutCellId) {
                delete wrapper.dataset.runOutCellId;
                wrapper.querySelectorAll('.run-out-candidate').forEach(el => {
                    el.classList.remove('run-out-candidate');
                });
            }

            // --- EXTRA BALL REMOVAL LOGIC ---
            const addedExtraId = cell.dataset.addedExtraId;
            if (addedExtraId) {
                const extraCellToRemove = document.getElementById(addedExtraId);
                if (extraCellToRemove) {
                    const parentRow = extraCellToRemove.closest('tr');
                    extraCellToRemove.remove();
                    if (parentRow.classList.contains('extra-over-row') && parentRow.querySelectorAll('.ball-cell').length === 0) {
                        parentRow.remove();
                    } else if (parentRow.classList.contains('extra-over-row')) {
                        const placeholderCell = parentRow.querySelector('td[colspan]:last-child');
                        if (placeholderCell) placeholderCell.colSpan += 1;
                    }
                }
                delete cell.dataset.addedExtraId;
            }

            // --- REVERT THE CELL ---
            cell.innerHTML = '';
            cell.appendChild(createBallSelectElement('Ball entry'));
            delete cell.dataset.isSplit;
            delete cell.dataset.eventType;
            delete cell.dataset.extraAdded;
            delete cell.dataset.wicketBatsmanId;
            delete cell.dataset.newBatsmanRowId;

            // --- RECALCULATE ---
            if (wicketBatsmanId) {
                updateWicketCountAndTotals();
            }
            const newSelect = cell.querySelector('.ball-select');
            recalculateAllStats(newSelect);

            const alertMessage = wicketBatsmanId ? 'Wicket entry has been reversed and all stats recalculated.' : 'Ball entry has been cleared and all stats recalculated.';
            alert(alertMessage);
        }
        // No 'else' block is needed because the only other option is the one that's already selected.
        // A more advanced version could handle changing from 'Wd' to 'Nb' here.
    } else if (target.classList.contains('split-ball-runs-select')) {
        const cell = target.closest('.ball-cell');
        const eventType = cell.dataset.eventType;
        const runsValue = target.value;

        // If the event is a Run Out OR a wicket is selected on any extra (stumping/run out),
        // we need to ask the user who was out.
        if (eventType === 'RO' || runsValue === 'W') {
            const activeRadios = Array.from(wrapper.querySelectorAll('input[name="on-strike"]:not(:disabled)'));
            const activeBatsmanRows = activeRadios.map(radio => radio.closest('tr'));

            if (activeBatsmanRows.length < 2 || !activeBatsmanRows[0].querySelector('.batsman-select').value || !activeBatsmanRows[1].querySelector('.batsman-select').value) {
                alert('Error: Cannot process run out/stumping. Please select two active batsmen from the batting scorecard first.');
                target.value = ''; // Reset the runs dropdown
                return;
            }

            // Also ensure one of them is on strike, otherwise we don't know who to credit runs to.
            const onStrikeRadio = wrapper.querySelector('input[name="on-strike"]:checked');
            if (!onStrikeRadio) {
                alert('Error: Cannot process run out/stumping. Please select which of the active batsmen is on strike first.');
                target.value = ''; // Reset the runs dropdown
                return;
            }

            // Mark the original cell so we can find it when the status is changed.
            const uniqueCellId = `ro-cell-${Date.now()}`;
            cell.id = uniqueCellId;
            wrapper.dataset.runOutCellId = uniqueCellId;

            // Highlight the status cells of the active batsmen
            activeBatsmanRows.forEach(row => {
                row.querySelector('.batsman-status-select').classList.add('run-out-candidate');
            });
            alert("WICKET! Please select 'Out' from the Status column for the batsman who was dismissed (stumping or run out).");
            saveState();
            return; // Stop processing. The rest of the logic is triggered by handleStatusChange.
        }

        // This is the second part of a split delivery (with runs, but no wicket), completing the event
        recalculateAllStats(target);
    } else if (target.classList.contains('bowler-select')) {
        // If a bowler is selected, guide the user to set up the batsmen if they haven't already.
        if (target.value) {
            const selectedBatsmen = wrapper.querySelectorAll('.batsman-select');
            const activeBatsmenCount = Array.from(selectedBatsmen).filter(s => s.value !== '').length;

            if (activeBatsmenCount < 2) {
                alert('Bowler selected. Now, please select the two opening batsmen from the batting scorecard.');
            } else if (!wrapper.querySelector('input[name="on-strike"]:checked')) {
                alert('Batsmen selected. Now, please select which batsman is on strike using the radio button.');
            }
        }
        saveState();
    }
    else if (target.classList.contains('batsman-select')) {
        // When a batsman is selected from a dropdown, update other dropdowns and enable the radio.
        handleBatsmanSelection(target);
    } else if (target.classList.contains('batsman-status-select')) {
        handleStatusChange(target);
    } else if (target.classList.contains('on-strike-radio')) {
        const tbody = target.closest('tbody');
        const allBallCells = wrapper.querySelectorAll('.ball-cell');
        const isFirstBall = Array.from(allBallCells).every(cell => {
            const select = cell.querySelector('.ball-select, .split-ball-runs-select');
            return !select || !select.value;
        });

        // The initial striker can be set or changed as long as no balls have been bowled.
        if (isFirstBall) {
            tbody.dataset.initialStrikerId = target.value; // target.value is the row ID
        }
        // Always save state when strike changes, as it might be the initial selection.
        saveState();
    }
}

/**
 * Dynamically adds a new ball input cell after the current one.
 * This now adds a new ROW for the extra ball, instead of a new column.
 * @returns {HTMLElement} The newly created 'td' element for the extra ball.
 * @param {HTMLElement} currentInputElement The input element that triggered the extra ball.
 */
function addExtraBall(currentInputElement) {
    // This function now returns the newly created ball cell element
    const currentRow = currentInputElement.closest('tr');
    const tbody = currentRow.closest('tbody');

    // 1. Find the main over row.
    const mainOverRow = currentRow.classList.contains('extra-over-row') 
        ? document.getElementById(currentRow.dataset.overRow) 
        : currentRow;
    const overId = mainOverRow.id;

    // 2. Find the last existing extra row for this over.
    const allExtraRowsForOver = tbody.querySelectorAll(`tr.extra-over-row[data-over-row="${overId}"]`);
    const lastExtraRow = allExtraRowsForOver.length > 0 ? allExtraRowsForOver[allExtraRowsForOver.length - 1] : null;

    // 3. Count ball cells in the last extra row.
    const ballCellsInLastRow = lastExtraRow ? lastExtraRow.querySelectorAll('.ball-cell').length : 0;

    let newBallCell; // This will hold the new cell we create

    // 4. Decide whether to add a new row (if no extra row exists or the last one is full) or a new cell.
    if (!lastExtraRow || ballCellsInLastRow >= 6) {
        // --- CREATE A NEW ROW ---
        // Find the absolute last row for this over (could be main row or an existing extra row)
        const allRowsForThisOver = [mainOverRow, ...allExtraRowsForOver];
        const lastRowForThisOver = allRowsForThisOver[allRowsForThisOver.length - 1];

        const newRow = document.createElement('tr');
        newRow.className = 'extra-over-row';
        newRow.dataset.overRow = overId;

        // The new row starts with one ball cell. The placeholder TD will span the remaining 8 columns.
        newRow.innerHTML = `
            <td colspan="2" class="extra-ball-indent"></td>
            <td class="ball-cell"></td>
            <td colspan="9"></td>
        `;
        newBallCell = newRow.querySelector('.ball-cell');
        newBallCell.appendChild(createBallSelectElement('Extra ball'));
        lastRowForThisOver.after(newRow);
    } else {
        // --- ADD A CELL TO THE EXISTING LAST EXTRA ROW ---
        // Correctly select the placeholder TD at the end of the row, not the indent at the start.
        const placeholderCell = lastExtraRow.querySelector('td[colspan]:last-child');
        newBallCell = document.createElement('td');
        newBallCell.className = 'ball-cell';
        newBallCell.appendChild(createBallSelectElement('Extra ball'));
        // Insert the new ball cell *before* the placeholder.
        lastExtraRow.insertBefore(newBallCell, placeholderCell);
        if (placeholderCell) {
            placeholderCell.colSpan -= 1;
        }
    }
    return newBallCell;
}

/**
 * Calculates and updates the runs for a specific over (row-wise) and the grand total (column-wise).
 * @param {HTMLElement} inputElement The ball-input element that was changed.
 */
function updateBowlingStats(inputElement) {
    const anyChildElement = inputElement;
    const row = anyChildElement.closest('tr');
    const table = anyChildElement.closest('table');

    // Find the main row for this over to update its totals.
    const mainOverRow = row.classList.contains('extra-over-row')
        ? document.getElementById(row.dataset.overRow)
        : row;
    const overId = mainOverRow.id;
    
    // Get all ball cells for this over, across all its rows.
    const allRowsForOver = [mainOverRow, ...table.querySelectorAll(`tr[data-over-row="${overId}"]`)];
    const allBallCells = [];
    allRowsForOver.forEach(r => {
        allBallCells.push(...r.querySelectorAll('.ball-cell'));
    });
    
    // 1. Calculate row-wise total (runs in the over)
    let overTotal = 0;
    let overWickets = 0;
    let overExtras = 0;

    allBallCells.forEach(cell => {
        if (cell.dataset.isSplit === 'true') {
            const eventType = cell.dataset.eventType;
            const runsSelect = cell.querySelector('.split-ball-runs-select');
            const runsValue = runsSelect ? runsSelect.value : '';
            const isWicket = runsValue === 'W';
            const runs = isWicket ? 0 : (parseInt(runsValue, 10) || 0);

            if (eventType === 'Wd' || eventType === 'Nb') {
                overExtras += 1;
                overTotal += 1 + runs; // 1 for the extra, plus byes/overthrows
                if (isWicket) {
                    overWickets += 1;
                }
            } else if (eventType === 'W') {
                // A 'W' (bowled, caught, etc.) counts as a wicket for the bowler.
                overWickets += 1;
                overTotal += runs; // Runs scored on the wicket ball (e.g. run out)
            } else if (eventType === 'RO') {
                // A 'RO' (run out) adds to the team's wicket total but not the bowler's.
                overTotal += runs;
            }
        } else {
            const select = cell.querySelector('.ball-select');
            if (select && select.value) {
                const value = select.value;
                if (value === 'W') {
                    // A 'W' (bowled, caught, etc.) is a wicket for the bowler but adds no runs.
                    overWickets += 1;
                } else {
                    overTotal += parseInt(value, 10) || 0;
                }
            }
        }
    });

    // Write the totals to the MAIN over row.
    mainOverRow.querySelector('.over-runs').textContent = overTotal;
    mainOverRow.querySelector('.over-wickets').textContent = overWickets;
    mainOverRow.querySelector('.over-extras').textContent = overExtras;

    // 2. Calculate "column-wise" total (the grand total for the innings)
    const allOverRuns = table.querySelectorAll('.over-runs');
    let grandTotal = 0;
    allOverRuns.forEach(cell => {
        grandTotal += parseInt(cell.textContent, 10) || 0;
    });
    table.querySelector('#bowling-grand-total').textContent = grandTotal;

    const allOverExtras = table.querySelectorAll('.over-extras');
    let totalExtras = 0;
    allOverExtras.forEach(cell => {
        totalExtras += parseInt(cell.textContent, 10) || 0;
    });
    table.querySelector('#bowling-total-extras').textContent = totalExtras;
}

/**
 * Handles the logic when a batsman's status is changed to 'Out'.
 * This is the central function for all dismissals.
 * @param {HTMLSelectElement} selectElement The status dropdown that was changed.
 */
function handleStatusChange(selectElement) {
    const row = selectElement.closest('tr');
    const wrapper = document.getElementById('scorecards-wrapper');
    // --- NEW: CHECK FOR WICKET-CAUSING CELL ---
    // This is a temporary state passed from updateBattingStats
    const wicketCellId = wrapper.dataset.wicketCausingCellId;
    // --- END NEW ---

    let causingCell = wicketCellId ? document.getElementById(wicketCellId) : null;

    if (selectElement.value === 'Out') {
        // Check if this was triggered by a run-out.
        const runOutCellId = wrapper.dataset.runOutCellId;
        if (runOutCellId) {
            causingCell = document.getElementById(runOutCellId);
            if (causingCell) {
                // This is a run-out or stumping. Link the dismissed batsman to the cell for reversal.
                causingCell.dataset.wicketBatsmanId = row.id;
            }
        }

        // A batsman has been marked 'Out'.
        // Now, disable the row controls for the dismissed batsman.
        const batsmanSelect = row.querySelector('.batsman-select');
        const radioInRow = row.querySelector('.on-strike-radio');

        selectElement.disabled = true;
        batsmanSelect.disabled = true;
        if (radioInRow) {
            // This is safe to do now because the stats have already been processed for a run out.
            radioInRow.disabled = true;
            radioInRow.checked = false;
        }

        // Update the master wicket count based on all 'Out' batsmen.
        updateWicketCountAndTotals();

        // Check if we need to add a new batsman.
        const totalWickets = parseInt(wrapper.querySelector('#bowling-total-wickets').textContent);
        const allPlayers = matchSettings.players[matchSettings.currentBattingTeam];
        const totalPlayers = allPlayers.length;
        if (totalWickets < totalPlayers - 1) {
            const tbody = row.closest('tbody');
            const newRow = addNewBatsmanRow(tbody, allPlayers);

            // Link the new batsman row to the cell that caused the wicket (either simple or run-out)
            if (causingCell && newRow) {
                causingCell.dataset.newBatsmanRowId = newRow.id;
            }
            // --- END NEW ---

            // Highlight the new row's select element to guide the user
            if (newRow) {
                const newSelect = newRow.querySelector('.batsman-select');
                newSelect.classList.add('needs-selection');
                // Optional: remove the highlight after a short delay or on focus
                setTimeout(() => newSelect.classList.remove('needs-selection'), 5000);
            }
            // Only alert for non-runout wickets to avoid alert spam
            if (!runOutCellId) {
                alert('Wicket! Please select the next batsman from the new row.');
            }
        }

        // If this was a run-out, NOW we trigger the recalculation after the new row has been added.
        if (runOutCellId) {
            if (causingCell) {
                recalculateAllStats(causingCell.querySelector('.split-ball-runs-select'), true);
                causingCell.id = ''; // remove the temporary id
            }

            // Clean up the run-out state.
            delete wrapper.dataset.runOutCellId;
            wrapper.querySelectorAll('.run-out-candidate').forEach(el => {
                el.classList.remove('run-out-candidate');
            });
        }

        // --- NEW: CLEAN UP TEMPORARY DATA ---
        // This must be done after the new row is potentially added and linked.
        if (wicketCellId) {
            delete wrapper.dataset.wicketCausingCellId;
        }
        // --- END NEW ---
        checkInningsEnd();
        saveState();
    }
    // Note: No logic for changing status back to "Not out" is implemented,
    // as this would require complex state reversal.
}

/**
 * A master recalculation function called when any ball entry is made or edited.
 * It ensures all stats are derived correctly from the current state of the DOM.
 * @param {HTMLElement} changedElement The element that triggered the recalculation.
 * @param {boolean} [skipWicketCheck=false] - If true, skips the re-processing of a wicket event.
 */
function recalculateAllStats(changedElement, skipWicketCheck = false) {
    // 1. Handle any wicket that might have just been entered by the change.
    // This must happen BEFORE recalculating batting stats to ensure the correct batsman is marked out.
    if (!skipWicketCheck) {
        updateWicketStatusFromChange(changedElement);
    }

    // 2. Recalculate bowling stats for the affected over. This is efficient and correct.
    updateBowlingStats(changedElement);

    // 3. Recalculate all batting stats from the start of the innings.
    // This is necessary because an edit can affect strike rotation for all subsequent balls.
    recalculateAllBattingStats();

    // 4. Update the master totals in the batting card footer.
    updateBattingTeamTotal();

    // 5. Save state and check if the innings/match is over.
    saveState();
    checkInningsEnd();
}

/**
 * Recalculates all individual batting stats (R, B, 4s, 6s, SR) by re-simulating the innings from the DOM.
 * This is the only reliable way to handle edits to past balls.
 */
function recalculateAllBattingStats() {
    const wrapper = document.getElementById('scorecards-wrapper');
    const battingTbody = wrapper.querySelector('.batting-table tbody');
    if (!battingTbody) return;

    // 1. Reset all calculated stats to 0 for all batsmen.
    const allBatsmanRows = Array.from(battingTbody.querySelectorAll('tr'));
    allBatsmanRows.forEach(row => {
        if (row.querySelector('.batsman-select')?.value) {
            row.querySelector('.batsman-runs').textContent = '0';
            row.querySelector('.batsman-balls').textContent = '0';
            row.querySelector('.batsman-fours').textContent = '0';
            row.querySelector('.batsman-sixes').textContent = '0';
            row.querySelector('.batsman-sr').textContent = '0.00';
        }
    });

    // 2. Determine the initial batting pair from the stored initial striker ID.
    const initialStrikerId = battingTbody.dataset.initialStrikerId;
    if (!initialStrikerId) return; // Can't proceed if we don't know who started.

    // The first two rows in the table are always the openers.
    const firstTwoRows = allBatsmanRows.slice(0, 2);
    let onStrikeRow = firstTwoRows.find(r => r.id === initialStrikerId);
    let offStrikeRow = firstTwoRows.find(r => r.id !== initialStrikerId);

    if (!onStrikeRow || !offStrikeRow) return; // Need two openers to start.

    // 3. Simulate the innings ball by ball.
    let legalDeliveriesInOver = 0;
    const allBallCells = wrapper.querySelectorAll('.ball-cell');

    allBallCells.forEach(cell => {
        const { runs, isLegal, isWicket, fours, sixes, eventType } = getBallProperties(cell);
        if (!eventType) return; // Skip empty cells.

        // Credit stats to the batsman who was on strike for this ball.
        if (onStrikeRow && eventType !== 'Wd') { // Wides don't add to batsman's score.
            onStrikeRow.querySelector('.batsman-runs').textContent = parseInt(onStrikeRow.querySelector('.batsman-runs').textContent) + runs;
            onStrikeRow.querySelector('.batsman-fours').textContent = parseInt(onStrikeRow.querySelector('.batsman-fours').textContent) + fours;
            onStrikeRow.querySelector('.batsman-sixes').textContent = parseInt(onStrikeRow.querySelector('.batsman-sixes').textContent) + sixes;
        }
        if (onStrikeRow && isLegal) {
            onStrikeRow.querySelector('.batsman-balls').textContent = parseInt(onStrikeRow.querySelector('.batsman-balls').textContent) + 1;
        }

        // --- NEW, ROBUST STRIKE & WICKET LOGIC ---

        const dismissedBatsmanRowId = cell.dataset.wicketBatsmanId;
        const wasStrikerDismissed = onStrikeRow && onStrikeRow.id === dismissedBatsmanRowId;

        // Flag the specific case where a non-striker is run out after crossing.
        const wasNonStrikerOutOnOddRun = dismissedBatsmanRowId && (runs % 2 !== 0) && offStrikeRow && offStrikeRow.id === dismissedBatsmanRowId;

        // After applying stats, handle strike rotation for the *next* ball.
        if (isLegal) legalDeliveriesInOver++;

        if (runs % 2 !== 0) { // Odd runs rotate strike.
            [onStrikeRow, offStrikeRow] = [offStrikeRow, onStrikeRow];
        }
        if (isLegal && legalDeliveriesInOver === 6) { // End of over rotates strike.
            [onStrikeRow, offStrikeRow] = [offStrikeRow, onStrikeRow];
            legalDeliveriesInOver = 0;
        }

        // If a wicket fell, substitute the dismissed player AFTER rotation.
        if (dismissedBatsmanRowId) {
            const newBatsmanRowId = cell.dataset.newBatsmanRowId;
            const newBatsmanRow = newBatsmanRowId ? document.getElementById(newBatsmanRowId) : null;

            if (newBatsmanRow) {
                // Replace the dismissed batsman in the pair, wherever they ended up after rotation.
                if (onStrikeRow && onStrikeRow.id === dismissedBatsmanRowId) onStrikeRow = newBatsmanRow;
                if (offStrikeRow && offStrikeRow.id === dismissedBatsmanRowId) offStrikeRow = newBatsmanRow;
            } else {
                // This branch handles the end of the innings (no new batsman available).
                if (onStrikeRow && onStrikeRow.id === dismissedBatsmanRowId) onStrikeRow = null;
                if (offStrikeRow && offStrikeRow.id === dismissedBatsmanRowId) offStrikeRow = null;
            }

            // EXPLICIT OVERRIDE FOR 'W' DISMISSALS (per user request & modern rules)
            // If the original striker was out to a 'W' event (e.g., bowled, caught),
            // the new batsman should take strike, unless it was the last ball of the over.
            // This overrides any run-based rotation that may have occurred.
            const isEndOfOver = isLegal && legalDeliveriesInOver === 0; // legalDeliveriesInOver is reset to 0 after the 6th ball
            if (wasStrikerDismissed && eventType === 'W' && !isEndOfOver) {
                // Find the new batsman (wherever they are after the initial rotation/substitution)
                // and ensure they are on strike.
                if (offStrikeRow && newBatsmanRow && offStrikeRow.id === newBatsmanRow.id) {
                    // If the new batsman ended up off-strike, swap the pair.
                    [onStrikeRow, offStrikeRow] = [offStrikeRow, onStrikeRow];
                }
            }
        }

        // Apply the correction for the specific run-out case.
        if (wasNonStrikerOutOnOddRun) {
            [onStrikeRow, offStrikeRow] = [offStrikeRow, onStrikeRow];
        }
    });

    // 4. Update Strike Rate for all batsmen.
    allBatsmanRows.forEach(row => {
        const runs = parseInt(row.querySelector('.batsman-runs').textContent);
        const balls = parseInt(row.querySelector('.batsman-balls').textContent);
        const srCell = row.querySelector('.batsman-sr');
        srCell.textContent = (balls > 0) ? ((runs / balls) * 100).toFixed(2) : '0.00';
    });

    // 5. Update the UI to reflect the final on-strike batsman from the simulation.
    allBatsmanRows.forEach(row => {
        const radio = row.querySelector('.on-strike-radio');
        if (radio) {
            radio.checked = false; // Uncheck all first
        }
    });
    if (onStrikeRow) {
        const finalOnStrikeRadio = onStrikeRow.querySelector('.on-strike-radio');
        // Only check the radio if it's for an active batsman (not disabled)
        if (finalOnStrikeRadio && !finalOnStrikeRadio.disabled) {
            finalOnStrikeRadio.checked = true;
        }
    }
}

/** This function is now only responsible for handling the 'Out' status change, not numbers. */
function updateWicketStatusFromChange(target) {
    const cell = target.closest('.ball-cell');
    const ballProperties = getBallProperties(cell);
    const { isWicket, eventType } = ballProperties;

    if (isWicket && eventType !== 'RO') {
        // This function is now only called for non-run-out wickets.
        // It marks the on-strike batsman as out.
        updateOnStrikeBatsmanAsOut(target, cell, ballProperties);
    }
}

/**
 * Handles the process of marking the on-strike batsman as out for non-run-out dismissals.
 * @param {HTMLElement} target - The element that triggered the event.
 * @param {HTMLTableCellElement} cell - The ball cell where the wicket occurred.
 * @param {object} ballProperties - The properties of the ball from getBallProperties.
 */
function updateOnStrikeBatsmanAsOut(target, cell, ballProperties) {
    const wrapper = document.getElementById('scorecards-wrapper');
    const onStrikeRadio = wrapper.querySelector('input[name="on-strike"]:checked');
    const onStrikeBatsmanRow = onStrikeRadio ? wrapper.querySelector(`#${onStrikeRadio.value}`) : null;

    // A wicket event requires a batsman on strike to be selected (to know who faced the ball).
    if (!onStrikeBatsmanRow) {
        // A non-RO wicket always requires a striker. Check if the action was significant enough to warrant an alert.
        if ((ballProperties.runs > 0 && ballProperties.eventType !== 'Wd') || ballProperties.isLegal || ballProperties.isWicket) {
            alert('Please select a batsman on strike.');
            if (target.value) target.value = '';
            return;
        }
    }

    // If we have a striker, mark them out.
    if (onStrikeBatsmanRow) {
        // Link the wicket to the cell and the batsman for recalculation and reversal.
        if (!cell.id) cell.id = `ball-cell-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        cell.dataset.wicketBatsmanId = onStrikeBatsmanRow.id;
        wrapper.dataset.wicketCausingCellId = cell.id; // Pass ID to handleStatusChange

        // Programmatically trigger the status change, which will handle the rest of the UI updates.
        onStrikeBatsmanRow.querySelector('.batsman-status-select').value = 'Out';
        onStrikeBatsmanRow.querySelector('.batsman-status-select').dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * A helper function to parse the properties of a ball from its cell in the DOM.
 * @param {HTMLTableCellElement} cell The .ball-cell element.
 * @returns {object} An object with properties of the ball event.
 */
function getBallProperties(cell) {
    let runs = 0, isLegal = false, isWicket = false, fours = 0, sixes = 0, eventType = '';

    const select = cell.querySelector('.ball-select, .split-ball-runs-select');
    if (!select || !select.value) return { eventType };

    const value = select.value;
    eventType = cell.dataset.eventType || value;

    isLegal = !['Wd', 'Nb'].includes(eventType);
    isWicket = (value === 'W' || ['W', 'RO'].includes(eventType));
    runs = (value === 'W') ? 0 : (parseInt(value, 10) || 0);
    if (runs === 4) fours = 1;
    if (runs === 6) sixes = 1;

    return { runs, isLegal, isWicket, fours, sixes, eventType };
}

/**
 * Counts all batsmen marked 'Out' and updates the total score displays.
 * This is the single source of truth for the wicket count.
 */
function updateWicketCountAndTotals() {
    const wrapper = document.getElementById('scorecards-wrapper');
    const battingRows = wrapper.querySelectorAll('.batting-table tbody tr');
    let wickets = 0;
    battingRows.forEach(row => {
        const statusSelect = row.querySelector('.batsman-status-select');
        if (statusSelect && statusSelect.value === 'Out') {
            wickets++;
        }
    });
    wrapper.querySelector('#bowling-total-wickets').textContent = wickets;
    updateBattingTeamTotal(); // This updates the "123/2" display in the batting card
}

/**
 * Handles the selection of a batsman from a dropdown.
 * @param {HTMLSelectElement} changedSelect The dropdown that was changed.
 */
function handleBatsmanSelection(changedSelect) {
    const wrapper = document.getElementById('scorecards-wrapper');
    const selectedValue = changedSelect.value;
    const row = changedSelect.closest('tr');
    const radio = row.querySelector('.on-strike-radio');

    // Enable the radio button only if a valid batsman is selected
    radio.disabled = !selectedValue;

    // Update all other dropdowns to remove the selected player as an option
    const allSelects = Array.from(wrapper.querySelectorAll('.batsman-select'));
    const allSelectedPlayers = allSelects.map(s => s.value).filter(Boolean);

    allSelects.forEach(select => {
        if (select !== changedSelect) {
            Array.from(select.options).forEach(option => {
                // Hide an option if it's selected in another dropdown,
                // but DON'T hide it if it's the currently selected value of THIS dropdown.
                // This prevents the non-striker's selection from being visually cleared when a new batsman is chosen.
                option.hidden = allSelectedPlayers.includes(option.value) && select.value !== option.value;
            });
        }
    });
}

function checkInningsEnd() {
    const wrapper = document.getElementById('scorecards-wrapper');
    const bowlingTable = wrapper.querySelector('.bowling-table');
    if (!bowlingTable) return;

    // Condition 1: All overs bowled
    let legalDeliveries = 0;
    bowlingTable.querySelectorAll('.ball-cell').forEach(cell => {
        // Check for split-view cells first
        if (cell.dataset.isSplit === 'true') {
            // A wicket ('W' or 'RO') is a legal delivery even in a split view. Wd and Nb are not.
            if (cell.dataset.eventType === 'W' || cell.dataset.eventType === 'RO') {
                legalDeliveries++;
            }
        } else {
            // Check for standard dropdowns
            const select = cell.querySelector('.ball-select');
            if (select && select.value) {
                const value = select.value;
                // A legal delivery is anything that isn't a Wide or No Ball and is not empty.
                if (value !== 'Wd' && value !== 'Nb' && value !== '') {
                    legalDeliveries++;
                }
            }
        }
    });
    const oversCompleted = Math.floor(legalDeliveries / 6);

    // Condition 2: All wickets fallen
    const wicketsFallen = parseInt(wrapper.querySelector('#bowling-total-wickets').textContent, 10);

    if (currentInningsNumber === 1 && (oversCompleted >= matchSettings.numOvers || wicketsFallen >= matchSettings.numPlayers - 1)) {
        document.querySelectorAll('#scorecards-wrapper select, #scorecards-wrapper input').forEach(el => el.disabled = true);
        document.getElementById('second-innings-container').classList.remove('hidden');
        alert('End of 1st Innings!');
    } else if (currentInningsNumber === 2 && (oversCompleted >= matchSettings.numOvers || wicketsFallen >= matchSettings.numPlayers - 1 || parseInt(wrapper.querySelector('#bowling-grand-total').textContent) >= matchSettings.targetScore)) {
        // End of 2nd innings / match
        document.querySelectorAll('#scorecards-wrapper select, #scorecards-wrapper input').forEach(el => el.disabled = true);
        alert('Match End!');
        generateMatchSummary();
        document.getElementById('post-match-actions').classList.remove('hidden');
        saveState(); // Save the final state
        currentInningsNumber = 0; // Reset for a new match
    }
}

function updateBattingTeamTotal() {
    const wrapper = document.getElementById('scorecards-wrapper');
    if (!wrapper.querySelector('#bowling-grand-total')) return; // Exit if scorecard isn't generated yet

    const totalRuns = wrapper.querySelector('#bowling-grand-total').textContent;
    const totalWickets = wrapper.querySelector('#bowling-total-wickets').textContent;
    const totalExtras = wrapper.querySelector('#bowling-total-extras').textContent;

    const battingTotalCell = wrapper.querySelector('#batting-total-score');
    if (battingTotalCell) {
        battingTotalCell.textContent = `${totalRuns}/${totalWickets}`;
    }

    const extrasCell = wrapper.querySelector('#batting-extras-total');
    if (extrasCell) {
        extrasCell.textContent = totalExtras;
    }
}

function generateMatchSummary() {
    // 1. Collect all necessary stats from the DOM
    const battingStats = collectAllBattingStats();
    const bowlingStats = collectAllBowlingStats();
    const finalScoreWrapper = document.getElementById('scorecards-wrapper');
    const secondInningsRuns = parseInt(finalScoreWrapper.querySelector('#bowling-grand-total').textContent, 10);
    const secondInningsWickets = parseInt(finalScoreWrapper.querySelector('#bowling-total-wickets').textContent, 10);

    // 2. Determine the winner and construct the result text
    const chasingTeamName = (matchSettings.firstInningsBattingTeam === 'Team A') ? 'Team B' : 'Team A';
    const defendingTeamName = matchSettings.firstInningsBattingTeam;
    let resultText = '';
    let winningTeamName = null; // Add this to store the winner's name

    if (secondInningsRuns >= matchSettings.targetScore) {
        // Chasing team won
        const wicketsInHand = matchSettings.numPlayers - 1 - secondInningsWickets;
        resultText = `${chasingTeamName} won by ${wicketsInHand} wickets.`;
        winningTeamName = chasingTeamName;
    } else if (secondInningsRuns === matchSettings.targetScore - 1) {
        // Match is tied
        resultText = 'Match Tied.';
    } else {
        // Defending team won
        const runsMargin = matchSettings.targetScore - 1 - secondInningsRuns;
        resultText = `${defendingTeamName} won by ${runsMargin} runs.`;
        winningTeamName = defendingTeamName;
    }

    // 3. Find top performers for each team
    const teamAPlayers = matchSettings.players['Team A'];
    const teamBPlayers = matchSettings.players['Team B'];
    const topScorerA = findTopScorer(battingStats.filter(p => teamAPlayers.includes(p.name)));
    const bestBowlerA = findBestBowler(bowlingStats.filter(p => teamAPlayers.includes(p.name)));
    const topScorerB = findTopScorer(battingStats.filter(p => teamBPlayers.includes(p.name)));
    const bestBowlerB = findBestBowler(bowlingStats.filter(p => teamBPlayers.includes(p.name)));
    const manOfTheMatch = findManOfTheMatch(battingStats, bowlingStats, winningTeamName);
    
    // 4. Construct score text
    const firstInningsScoreText = `${defendingTeamName}: ${matchSettings.firstInningsScore}/${matchSettings.firstInningsWickets}`;
    const secondInningsScoreText = `${chasingTeamName}: ${secondInningsRuns}/${secondInningsWickets}`;

    // 5. Populate the summary container
    const summaryContainer = document.getElementById('match-summary-container');
    summaryContainer.innerHTML = `
        <h2>Match Summary</h2>
        <h3>${resultText}</h3>
        <div class="man-of-the-match">
            <h4>Man of the Match</h4>
            <p>${manOfTheMatch.name}</p>
        </div>
        <div class="final-scores">
            <p>${firstInningsScoreText}</p>
            <p>${secondInningsScoreText}</p>
        </div>
        <hr>
        <h4>Team A Top Performers</h4>
        <p><strong>Best Batsman:</strong> ${topScorerA.name} - ${topScorerA.runs} (4s: ${topScorerA.fours}, 6s: ${topScorerA.sixes}, SR: ${topScorerA.sr})</p>
        <p><strong>Best Bowler:</strong> ${bestBowlerA.name} - ${bestBowlerA.wickets}/${bestBowlerA.runs} (ER: ${bestBowlerA.economy.toFixed(2)})</p>
        <hr>
        <h4>Team B Top Performers</h4>
        <p><strong>Best Batsman:</strong> ${topScorerB.name} - ${topScorerB.runs} (4s: ${topScorerB.fours}, 6s: ${topScorerB.sixes}, SR: ${topScorerB.sr})</p>
        <p><strong>Best Bowler:</strong> ${bestBowlerB.name} - ${bestBowlerB.wickets}/${bestBowlerB.runs} (ER: ${bestBowlerB.economy.toFixed(2)})</p>
    `;
    summaryContainer.classList.remove('hidden');
}

function collectAllBattingStats() {
    const stats = [];
    document.querySelectorAll('#first-innings-summary .batting-table tbody tr, #scorecards-wrapper .batting-table tbody tr').forEach(row => {
        const select = row.querySelector('.batsman-select');
        let name = '';
        if (select && select.selectedIndex > 0) {
            name = select.options[select.selectedIndex].text;
        }

        if (name) {
            const runs = parseInt(row.querySelector('.batsman-runs').textContent, 10);
            const balls = parseInt(row.querySelector('.batsman-balls').textContent, 10);
            const fours = parseInt(row.querySelector('.batsman-fours').textContent, 10);
            const sixes = parseInt(row.querySelector('.batsman-sixes').textContent, 10);
            const sr = (balls > 0) ? ((runs / balls) * 100).toFixed(2) : '0.00';

            stats.push({ name, runs, balls, fours, sixes, sr });
        }
    });
    return stats;
}

function collectAllBowlingStats() {
    const stats = {}; // Use object to aggregate stats per bowler
    document.querySelectorAll('#first-innings-summary .bowling-table tbody tr, #scorecards-wrapper .bowling-table tbody tr').forEach(row => {
        const select = row.querySelector('.bowler-select');
        let name = '';
        if (select && select.selectedIndex > 0) {
            name = select.options[select.selectedIndex].text;
        }

        if (!name) return;

        if (!stats[name]) {
            stats[name] = { name, wickets: 0, runs: 0, balls: 0 };
        }

        stats[name].runs += parseInt(row.querySelector('.over-runs').textContent, 10);
        stats[name].wickets += parseInt(row.querySelector('.over-wickets').textContent, 10);

        // Count legal balls from all ball cells in the row
        row.querySelectorAll('.ball-cell').forEach(cell => {
            if (cell.dataset.isSplit === 'true') {
                // A wicket ('W' or 'RO') is a legal delivery even in a split view. Wd and Nb are not.
                if (cell.dataset.eventType === 'W' || cell.dataset.eventType === 'RO') {
                    stats[name].balls++;
                }
            } else {
                const ballSelect = cell.querySelector('.ball-select');
                if (ballSelect && ballSelect.value) {
                    const value = ballSelect.value;
                    // A legal delivery is anything that isn't a Wide or No Ball and is not empty.
                    if (value !== 'Wd' && value !== 'Nb' && value !== '') {
                        stats[name].balls++;
                    }
                }
            }
        });
    });
    return Object.values(stats); // Convert back to array
}

function findManOfTheMatch(battingStats, bowlingStats, winningTeamName) {
    const playerPoints = {};
    
    // If there's no winner (e.g., a tie), we can't award MOTM from the winning team.
    if (!winningTeamName) {
        return { name: 'N/A (Match Tied)' };
    }

    const winningTeamPlayers = matchSettings.players[winningTeamName];

    // Helper to initialize player points
    const initPlayer = (name) => {
        if (!playerPoints[name]) {
            playerPoints[name] = 0;
        }
    };

    // 1. Add points for runs and batting milestones for players from the winning team
    battingStats
        .filter(player => winningTeamPlayers.includes(player.name))
        .forEach(player => {
            initPlayer(player.name);
            playerPoints[player.name] += player.runs; // 1 point per run

            // Bonus for 50 or 100
            if (player.runs >= 100) {
                playerPoints[player.name] += 30; // Bonus for a century
            } else if (player.runs >= 50) {
                playerPoints[player.name] += 15; // Bonus for a half-century
            }
        });

    // 2. Add points for wickets, bowling milestones, and economy rate for players from the winning team
    bowlingStats
        .filter(player => winningTeamPlayers.includes(player.name))
        .forEach(player => {
            initPlayer(player.name);
            playerPoints[player.name] += player.wickets * 25; // 25 points per wicket

            // Bonus for 3 or 5 wicket hauls
            if (player.wickets >= 5) {
                playerPoints[player.name] += 30; // Bonus for 5-wicket haul
            } else if (player.wickets >= 3) {
                playerPoints[player.name] += 15; // Bonus for 3-wicket haul
            }

            // Bonus for economy rate (if they bowled at least 2 overs)
            if (player.balls >= 12) {
                const economy = (player.runs / player.balls) * 6;
                if (economy <= 4.0) {
                    playerPoints[player.name] += 15;
                } else if (economy <= 6.0) {
                    playerPoints[player.name] += 10;
                }
            }
        });

    if (Object.keys(playerPoints).length === 0) {
        // This can happen if the winning team had no scorable actions.
        return { name: 'N/A' };
    }

    // Find the player with the most points
    const topPerformer = Object.keys(playerPoints).reduce((a, b) => playerPoints[a] > playerPoints[b] ? a : b, Object.keys(playerPoints)[0]);
    return { name: topPerformer };
}

function findTopScorer(battingStats) {
    if (battingStats.length === 0) return { name: 'N/A', runs: 0, balls: 0, fours: 0, sixes: 0, sr: '0.00' };

    // Sort by runs (desc), then by balls faced (asc) for a better strike rate as a tie-breaker.
    battingStats.sort((a, b) => {
        if (a.runs !== b.runs) {
            return b.runs - a.runs; // Higher runs first
        }
        return a.balls - b.balls; // Fewer balls for the same runs is better
    });
    return battingStats[0];
}

function findBestBowler(bowlingStats) {
    if (bowlingStats.length === 0) return { name: 'N/A', wickets: 0, runs: 0, economy: 0.00 };

    // Calculate economy rate for each bowler for display purposes
    bowlingStats.forEach(bowler => {
        if (bowler.balls > 0) {
            bowler.economy = (bowler.runs / bowler.balls) * 6;
        } else {
            bowler.economy = 0.00;
        }
    });

    // Sort by wickets (desc), then by runs conceded (asc) as a tie-breaker.
    bowlingStats.sort((a, b) => {
        if (a.wickets !== b.wickets) {
            return b.wickets - a.wickets; // More wickets is better
        }
        return a.runs - b.runs; // Fewer runs conceded is better
    });

    return bowlingStats[0];
}

/**
 * Resets the entire application to the initial setup screen.
 * Clears all state and dynamic content.
 */
function restartMatch() {
    // Store settings to repopulate the form for convenience
    const playersToKeep = matchSettings ? matchSettings.numPlayers : '';
    const oversToKeep = matchSettings ? matchSettings.numOvers : '';

    // Hide all dynamic sections
    document.getElementById('first-innings-summary').classList.add('hidden');
    document.getElementById('scorecards-wrapper').classList.add('hidden');
    document.getElementById('second-innings-container').classList.add('hidden');
    document.getElementById('match-summary-container').classList.add('hidden');
    document.getElementById('post-match-actions').classList.add('hidden');
    document.getElementById('start-match-container').classList.add('hidden');
    document.getElementById('player-lists-wrapper').classList.add('hidden');
    document.getElementById('force-restart-btn').classList.add('hidden');

    // Show the initial setup form
    document.querySelector('.setup-container').classList.remove('hidden');

    // Restore the saved settings to the form inputs
    document.getElementById('num-players').value = playersToKeep || '';
    document.getElementById('num-overs').value = oversToKeep || '';

    // Clear the dynamic content from the completed match
    document.getElementById('scorecards-wrapper').innerHTML = '';
    document.getElementById('first-innings-summary').innerHTML = '';
    document.getElementById('match-summary-container').innerHTML = '';
    document.getElementById('player-lists-wrapper').innerHTML = '';

    // Reset global state variables and clear localStorage for a fresh start
    matchSettings = {};
    currentInningsNumber = 0;
    clearState();

    // 7. Scroll to the top of the page to show the setup form
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Saves the entire application state to localStorage.
 */
function saveState() {
    const state = {
        matchSettings: matchSettings,
        currentInningsNumber: currentInningsNumber,
        scorecardsWrapperHTML: document.getElementById('scorecards-wrapper').innerHTML,
        firstInningsSummaryHTML: document.getElementById('first-innings-summary').innerHTML,
        matchSummaryHTML: document.getElementById('match-summary-container').innerHTML,
        // Save the visibility state of all major containers
        visibility: {
            setup: document.querySelector('.setup-container').classList.contains('hidden'),
            playerLists: document.getElementById('player-lists-wrapper').classList.contains('hidden'),
            startMatch: document.getElementById('start-match-container').classList.contains('hidden'),
            scorecards: document.getElementById('scorecards-wrapper').classList.contains('hidden'),
            secondInningsBtn: document.getElementById('second-innings-container').classList.contains('hidden'),
            firstInningsSummary: document.getElementById('first-innings-summary').classList.contains('hidden'),
            matchSummary: document.getElementById('match-summary-container').classList.contains('hidden'),
            postMatchActions: document.getElementById('post-match-actions').classList.contains('hidden')
        }
    };

    try {
        localStorage.setItem('cricketMatchState', JSON.stringify(state));
    } catch (e) {
        console.error("Could not save state to localStorage:", e);
    }
}

/**
 * Loads the application state from localStorage if it exists.
 */
function loadState() {
    try {
        const savedStateJSON = localStorage.getItem('cricketMatchState');
        if (!savedStateJSON) return;

        const savedState = JSON.parse(savedStateJSON);

        // Restore global variables
        matchSettings = savedState.matchSettings;
        currentInningsNumber = savedState.currentInningsNumber;

        // Restore HTML content
        document.getElementById('scorecards-wrapper').innerHTML = savedState.scorecardsWrapperHTML;
        document.getElementById('first-innings-summary').innerHTML = savedState.firstInningsSummaryHTML;
        document.getElementById('match-summary-container').innerHTML = savedState.matchSummaryHTML;

        // Restore visibility of all containers
        document.querySelector('.setup-container').classList.toggle('hidden', savedState.visibility.setup);
        document.getElementById('player-lists-wrapper').classList.toggle('hidden', savedState.visibility.playerLists);
        document.getElementById('start-match-container').classList.toggle('hidden', savedState.visibility.startMatch);
        document.getElementById('scorecards-wrapper').classList.toggle('hidden', savedState.visibility.scorecards);
        document.getElementById('second-innings-container').classList.toggle('hidden', savedState.visibility.secondInningsBtn);
        document.getElementById('first-innings-summary').classList.toggle('hidden', savedState.visibility.firstInningsSummary);
        document.getElementById('match-summary-container').classList.toggle('hidden', savedState.visibility.matchSummary);
        document.getElementById('post-match-actions').classList.toggle('hidden', savedState.visibility.postMatchActions);

        // Also restore the visibility of the "New Match" button
        const setupIsHidden = savedState.visibility.setup;
        document.getElementById('force-restart-btn').classList.toggle('hidden', !setupIsHidden);

    } catch (e) {
        console.error("Could not load state from localStorage:", e);
        clearState(); // Clear corrupted state
    }
}

/**
 * Clears the saved state from localStorage.
 */
function clearState() {
    localStorage.removeItem('cricketMatchState');
}
