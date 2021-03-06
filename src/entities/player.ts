import {mat4, quat, vec2, vec3} from "gl-matrix";

import {Player_State, PlayerModel} from "./models/playermodel";
import {Entity, Model_Type} from "./entity";
import {World} from "./world";
import {MathHelper} from "../helpers/mathhelper";
import * as assert from "assert";
import {Shader} from "../shader";
import vec2_rotate = MathHelper.vec2_rotate;

const SPEED = 10;
const JUMP_UP_SPEED = 12.0;
const JUMP_FORWARD_SPEED = 8.0;

const TURNING_DEGREES = 3.0;
const ACCEL_FORWARD = 25.0;
const ACCEL = 10.0;

let old_pos = vec3.create();
let new_pos = vec3.create();
let accel = vec3.create();
let dir = vec2.create();
let min_direction = vec2.create();
let GRAVITY = vec3.fromValues(0, -9.8, 0);

let model_matrix: mat4 = mat4.create();
let q: quat = quat.create();

export class Player extends Entity {
    public model: PlayerModel;
    public loaded: boolean;

    private velocity: vec3;
    private jumping: boolean;

    public radius: number;
    public half_height: number;

    constructor() {
        super("player", Model_Type.ANIMATED);
        this.velocity = vec3.create();
    }

    public init(gl: WebGL2RenderingContext) {
        this.model.init(gl);
    }

    public getVelocity(): vec3 {
        return this.velocity;
    }

    public draw(gl: WebGL2RenderingContext, shader: Shader, view_matrix: mat4, proj_matrix: mat4, camera_pos: vec3) {
        assert(this.loaded);

        mat4.identity(model_matrix);
        quat.identity(q);
        quat.rotateY(q, q, Math.atan2(this.forward[0], this.forward[2]) - Math.PI / 2);
        mat4.fromRotationTranslation(model_matrix, q, this.position);

        this.model.draw(gl, shader, model_matrix, view_matrix, proj_matrix, camera_pos);
    }

    public updateAnimation(delta_ms: number): void {
        this.model.updateAnimation(delta_ms);
    }

    public update(world: World, delta_time_ms: number): void {
        let delta_time_s = delta_time_ms / 1000;

        vec3.copy(old_pos, this.position);
        vec3.scaleAndAdd(new_pos, this.position, this.velocity, delta_time_s);

        let player_base_y = world.getHeightAtCirclePosition(new_pos[0], new_pos[2], this.model.radius);
        let player_y = player_base_y + this.model.half_height;

        if (this.jumping) {
            vec3.scaleAndAdd(this.velocity, this.velocity, GRAVITY, delta_time_s);

            if (world.isCylinderCollisionWithDisk(new_pos, this.model.radius, this.model.half_height)) {
                if (world.isCylinderCollisionWithDisk(old_pos, this.model.radius, this.model.half_height)) {
                    //Collided from above disk. stop falling
                    this.jumping = false;
                    this.model.setState(Player_State.Standing);
                    this.velocity[1] = 0;
                    new_pos[1] = player_y;
                } else {
                    //Collided with side of disk. Stop forward velocity
                    this.velocity[0] = this.velocity[2] = 0;
                    new_pos[0] = old_pos[0];
                    new_pos[2] = old_pos[2];
                }
            }
        } else {
            //Not jumping
            if (world.isOnDisk(new_pos[0], new_pos[2], this.model.radius)) {
                //Not Falling
                new_pos[1] = player_y;
                this.velocity[1] = 0;

                //Apply friction
                let friction = world.getFrictionAtPosition(new_pos[0], new_pos[2]);
                vec3.scale(this.velocity, this.velocity, Math.pow(friction, delta_time_s));

                //Apply Sliding
                let min_slope = world.getSlopeFactorAtPosition(new_pos[0], new_pos[2]);
                let min_height = player_base_y;

                vec2.set(min_direction, 0, 0);

                for (let i = 0; i < 60; i++) {
                    //Rotate the direction so we get 60 equally spaced direction around circle
                    vec2.set(dir, 1, 0);
                    vec2_rotate(dir, dir, Math.PI * 2 * (i / 60));

                    let h = world.getHeightAtPointPosition(new_pos[0] + dir[0] * 0.01, new_pos[2] + dir[1] * 0.01);
                    if (h < min_height) {
                        min_height = h;
                        min_direction = dir;
                    }
                }

                let slope = (player_base_y - min_height) / 0.01;

                if (slope > min_slope) {
                    let a = (slope - min_slope) * 10.0 * delta_time_s;
                    vec3.set(accel, min_direction[0], 0, min_direction[1]);
                    vec3.scale(accel, accel, a);
                    this.addAcceleration(accel);
                }
            } else {
                //Start Falling
                this.jumping = true;
                this.model.setState(Player_State.Falling);
            }
        }

        vec3.copy(this.position, new_pos);
    }

    public hitByBat(bat_velocity: vec3): void {
        if (this.jumping) {
            vec3.scaleAndAdd(this.velocity, this.velocity, vec3.normalize(bat_velocity, bat_velocity), 7.0);
        } else {
            vec3.copy(this.velocity, bat_velocity);
            this.velocity[1] = 0;
            vec3.scale(this.velocity, vec3.normalize(this.velocity, this.velocity), 5.0);
            this.velocity[1] = 5.0;
            this.model.setState(Player_State.Jumping);
            this.jumping = true;
        }
    }

    public reset(world: World): void {
        vec3.copy(this.position, world.disks[0].position);
        this.position[1] = world.getHeightAtPointPosition(this.position[0], this.position[2]) + this.model.half_height;
        vec3.set(this.velocity, 0, 0, 0);
        this.jumping = false;
    }

    public addAcceleration(a: vec3): void {
        if (!this.jumping) vec3.add(this.velocity, this.velocity, a);
    }

    public jump(): void {
        if (this.jumping) return;
        vec3.set(this.velocity, 0, JUMP_UP_SPEED, 0);
        vec3.scaleAndAdd(this.velocity, this.velocity, this.forward, JUMP_FORWARD_SPEED);
        this.model.setState(Player_State.Jumping);
        this.jumping = true;
    }

    rotate(angle: number): void {
        vec3.rotateY(this.forward, this.forward, [0, 0, 0], angle * 2);
    }

    public accelerateForward(delta_time_ms: number, speed_factor: number): void {
        vec3.copy(accel, this.forward);
        vec3.scale(accel, accel, ACCEL_FORWARD * delta_time_ms / 1000 * speed_factor);
        this.addAcceleration(accel);
    }

    public accelerateBackward(delta_time_ms: number, speed_factor: number): void {
        vec3.copy(accel, this.forward);
        vec3.negate(accel, accel);
        vec3.scale(accel, accel, ACCEL_FORWARD * delta_time_ms / 1000 * speed_factor);
        this.addAcceleration(accel);
    }

    public accelerateLeft(delta_time_ms: number, speed_factor: number): void {
        accel = this.getRight(accel);
        vec3.negate(accel, accel);
        vec3.scale(accel, accel, ACCEL * delta_time_ms / 1000 * speed_factor);
        this.addAcceleration(accel);
    }

    public accelerateRight(delta_time_ms: number, speed_factor: number): void {
        accel = this.getRight(accel);
        vec3.scale(accel, accel, ACCEL * delta_time_ms / 1000 * speed_factor);
        this.addAcceleration(accel);
    }

    public turnLeft(delta_time_ms: number): void {
        let amount = TURNING_DEGREES * delta_time_ms / 1000;
        vec3.rotateY(this.forward, this.forward, [0, 0, 0], amount);
    }

    public turnRight(delta_time_ms: number): void {
        let amount = TURNING_DEGREES * delta_time_ms / 1000;
        vec3.rotateY(this.forward, this.forward, [0, 0, 0], -amount);
    }

    public transitionAnimationTo(state: Player_State): void {
        if (!this.jumping) this.model.setState(state);
    }

    public async loadAssets(): Promise<void> {
        this.model = new PlayerModel();
        await this.model.load();
        this.loaded = true;
        this.radius = this.model.radius;
        this.half_height = this.model.half_height;
        return;
    }
}
