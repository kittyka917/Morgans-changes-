fx_version 'cerulean'
game 'gta5'

name 'mainstreet-loading'
description 'MainStreet RP loading screen'
version '1.0.0'

loadscreen 'html/index.html'
loadscreen_cursor 'yes'              -- lets players click the music button
loadscreen_manual_shutdown 'yes'     -- stays up until the player has spawned (see client.lua)

client_script 'client.lua'

files {
    'html/index.html',
    'html/style.css',
    'html/app.js',
    'html/config.js',
    'html/fonts/*.woff2',
    'html/music/*.ogg',
    'html/img/*',
}
