-- The manifest asks for a manual shutdown so the screen stays up while the
-- world streams in. Close it once the player has spawned.
--
-- If your character-select resource already calls ShutdownLoadingScreenNui()
-- when it opens, that works too: closing twice does no harm.

local closed = false

local function closeLoadingScreen()
    if closed then return end
    closed = true
    ShutdownLoadingScreen()
    ShutdownLoadingScreenNui()
end

AddEventHandler('playerSpawned', closeLoadingScreen)

-- Other resources can close it on demand:
--   TriggerEvent('mainstreet-loading:close')   or   exports['mainstreet-loading']:close()
AddEventHandler('mainstreet-loading:close', closeLoadingScreen)
exports('close', closeLoadingScreen)
