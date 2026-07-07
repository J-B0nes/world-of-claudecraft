// Protect Yumi team identity on the fighters themselves: a glowing blue/red
// ground ring under every participant (MOBA convention). Rings are children
// of each fighter's view group, so they track position and survive whatever
// the rig is doing; the roster comes from arenaInfo.match.yumi (both team
// scoreboards carry every pid), so all ten fighters read at a glance for
// EVERY viewer, on every graphics tier (team identity is actionable info).
//
// Owned by the renderer as a tiny per-frame manager: renderer.ts calls
// update() once per frame next to the maze views; everything else lives here
// (module-first, no EntityView field changes).
import * as THREE from 'three';
import type { IWorld } from '../world_api';

const TEAM_BLUE = 0x2f6fe0;
const TEAM_RED = 0xd8342c;
const RING_INNER = 0.6;
const RING_OUTER = 0.92;
const RING_Y = 0.07;
const RING_OPACITY = 0.6;

interface RingEntry {
  mesh: THREE.Mesh;
  team: 'A' | 'B';
  group: THREE.Group;
}

/** The minimal slice of the renderer's per-entity view the rings need. */
export interface RingHostView {
  group: THREE.Group;
}

export class YumiTeamRings {
  private readonly rings = new Map<number, RingEntry>();
  private readonly geo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 28);
  private readonly mats = {
    A: new THREE.MeshBasicMaterial({
      color: TEAM_BLUE,
      transparent: true,
      opacity: RING_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    B: new THREE.MeshBasicMaterial({
      color: TEAM_RED,
      transparent: true,
      opacity: RING_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  } as const;

  update(world: IWorld, views: ReadonlyMap<number, RingHostView>): void {
    const yumi = world.arenaInfo?.match?.yumi;
    if (!yumi) {
      if (this.rings.size > 0) this.clear();
      return;
    }
    // Mark-and-sweep against the roster so a leaver's ring goes with them.
    for (const [pid, entry] of this.rings) {
      const view = views.get(pid);
      if (!view || view.group !== entry.group) {
        entry.mesh.removeFromParent();
        this.rings.delete(pid);
      }
    }
    const ensure = (pid: number, team: 'A' | 'B') => {
      const view = views.get(pid);
      if (!view) return;
      const existing = this.rings.get(pid);
      if (existing && existing.team === team && existing.group === view.group) return;
      if (existing) existing.mesh.removeFromParent();
      const mesh = new THREE.Mesh(this.geo, this.mats[team]);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = RING_Y;
      view.group.add(mesh);
      this.rings.set(pid, { mesh, team, group: view.group });
    };
    for (const p of yumi.teamA) ensure(p.pid, 'A');
    for (const p of yumi.teamB) ensure(p.pid, 'B');
  }

  clear(): void {
    for (const entry of this.rings.values()) entry.mesh.removeFromParent();
    this.rings.clear();
  }
}
