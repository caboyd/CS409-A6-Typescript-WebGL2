import { Entity, Model_Type } from "./entity";
import { Player } from "./player";
import { World } from "./world";
import { BasicModel } from "./models/basicmodel";
import { vec3 } from "gl-matrix";
import { Random } from "../helpers/random";
import { Collision } from "../helpers/collision";
import { MathHelper } from "../helpers/mathhelper";
import vec3_truncate = MathHelper.vec3_truncate;

enum Bat_State {
    DEAD,
    PURSUE,
    EXPLORE
}

export class Bat extends Entity {
    public readonly radius: number = 0.7;
    public readonly half_height: number = 0.1;
    private readonly player: Readonly<Player>;
    private readonly world: Readonly<World>;
    private state: Bat_State;
    public velocity: vec3;
    private target_position: vec3;
    public ignore_timer: number = 0;

    public readonly S_MAX = 5.0;
    private readonly S_MIN = 1.0;
    private readonly A_MAX = 8.0;

    constructor(position: vec3, model: BasicModel, player: Readonly<Player>, world: Readonly<World>) {
        super(model.mesh.name, Model_Type.BASIC, position);
        this.player = player;
        this.world = world;
        this.radius = model.radius;
        this.half_height = model.half_height;
        this.state = Bat_State.EXPLORE;

        this.position = vec3.clone(position);
        this.velocity = vec3.fromValues(Random.randf(0, this.S_MAX), 0, Random.randf(0, this.S_MAX));
        vec3.normalize(this.forward, this.velocity);

        this.target_position = this.world.getRandomXZPosition();
        this.target_position[1] = 15.0;
    }

    public update(delta_ms: number): void {
        let delta_s = delta_ms / 1000;

        if (this.state == Bat_State.DEAD) return;

        this.ignore_timer -= delta_s;
        if (this.ignore_timer < 0) this.ignore_timer = 0;

        if (this.world.isCylinderCollisionWithDisk(this.position, this.radius, 0)) {
            this.state = Bat_State.DEAD;
            this.ignore_timer = 1.0;
            return;
        }

        if (
            Collision.cylinderIntersection(
                this.position,
                this.radius + 20,
                this.half_height + 20,
                this.player.position,
                this.player.radius,
                this.player.half_height
            )
        ) {
            this.state = Bat_State.PURSUE;
        } else {
            this.state = Bat_State.EXPLORE;
        }

        switch (this.state) {
            case Bat_State.EXPLORE: {
                this.explore(delta_s);
                break;
            }
            case Bat_State.PURSUE: {
                this.pursue(delta_s);
                break;
            }
        }
    }

    private explore(delta_s: number): void {
        if (
            Collision.cylinderIntersection(this.position, this.radius, this.half_height, this.target_position, 2.0, 1.0)
        ) {
            this.target_position = this.world.getRandomXZPosition();
            this.target_position[1] = 15.0;
        }
        this.seek(delta_s);
    }

    private seek(delta_s: number) {
        let R = vec3.sub(vec3.create(), this.target_position, this.position);
        let D = vec3.normalize(vec3.create(), R);
        vec3.scale(D, D, this.S_MAX);

        let S = vec3.sub(vec3.create(), D, this.velocity);

        let A_desired = vec3.scale(vec3.create(), S, 1 / delta_s);

        let A = vec3_truncate(vec3.create(), A_desired, this.A_MAX);

        // velocity = truncate(velocity + A * delta_s, S_MAX)
        vec3_truncate(this.velocity, vec3.scaleAndAdd(this.velocity, this.velocity, A, delta_s), this.S_MAX);

        vec3.scaleAndAdd(this.position, this.position, this.velocity, delta_s);

        vec3.normalize(this.forward, this.velocity);
    }

    private pursue(delta_s: number): void {
        let D = vec3.sub(vec3.create(), this.player.position, this.position);
        let s = vec3.length(D) * 0.3;

        let T = vec3.scaleAndAdd(vec3.create(), this.player.position, this.player.getVelocity(), s);

        this.target_position = vec3.clone(T);

        this.seek(delta_s);
    }
}
