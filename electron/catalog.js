// Every Camel Studios game the client knows about.
// repo: where its installers are published (GitHub releases). exe: what gets installed.
// local: an installer on this PC, used when a game (or a newer build) isn't published yet.
module.exports = [
  {
    id: 'riftline', name: 'Riftline', accent: '#ff4655', genre: 'Tactical shooter',
    tagline: 'A tactical 3D 1v1 / 2v2 shooter with agents and abilities.',
    about: 'Pick an agent, buy your loadout and plant or defuse across six maps. Play a friend with a room code, or practise against bots.',
    repo: 'Camells1/riftline', asset: 'Riftline-Setup.exe', exe: 'Riftline.exe', dir: 'Riftline',
    local: 'D:/Floor 2/pvp-shooter/dist/Riftline-Setup.exe'
  },
  {
    id: 'shattercrown', name: 'Shattercrown', accent: '#b98cff', genre: 'Action RPG',
    tagline: 'A pixel-art action RPG with online co-op.',
    about: 'Build a hero, clear the cliffs and the keep, and bring down the bosses alone or with friends.',
    repo: 'Camells1/Emberfall', asset: 'Shattercrown-Setup.exe', exe: 'Shattercrown.exe', dir: 'Shattercrown',
    local: 'D:/Projects/Emberfall/dist/Shattercrown-Setup.exe'
  },
  {
    id: 'hollowtide', name: 'Hollowtide', accent: '#6fe0d0', genre: 'Co-op adventure',
    tagline: 'When the tide drains, the ruins are yours.',
    about: 'A first-person scramble across a drained lagoon: loot sunken cities, fight hollow crabs and get back to an island before the sea returns. Solo or co-op with proximity voice.',
    repo: 'Camells1/Hollowtide', asset: 'Hollowtide-Setup.exe', exe: 'Hollowtide.exe', dir: 'Hollowtide',
    local: 'D:/Projects/Hollowtide/dist/Hollowtide-Setup.exe'
  }
];
