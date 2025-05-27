class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 700;
        this.DRAG = 1000;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -420;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 3;
        this.MAX_X_SPEED = 250; // Adjust this value to your desired max speed
        this.jumpsUsed = 0;
        this.maxJumps = 2;
        this.startTime = 0;
        this.rText = false;
        this.score = 0;
    }

    create() {
        this.startTime = this.time.now;
        this.bgSound = this.sound.add('bg', {
            loop: true,
            volume: 0.3,
            rate: 0.6  // 80% speed (slowed down)
        });

        this.bgSound.play();


        // Create a new tilemap game object which uses 18x18 pixel tiles, and is 45 tiles wide and 25 tiles tall.
        this.map = this.add.tilemap("platformer-level-1");

        // Add a tileset to the map
        // First parameter: name we gave the tileset in Tiled
        // Second parameter: key for the tilesheet (from this.load.image in Load.js)
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");

        // Create layers
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.hazardLayer = this.map.createLayer("Hazards", this.tileset, 0, 0);

        // Make layers collidable
        this.groundLayer.setCollisionByProperty({ collides: true });
        this.hazardLayer.setCollisionByProperty({ water: true });

        // Find coins in the "Objects" layer in Phaser
        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });

        this.flags = this.map.createFromObjects("Goal", {
            name: "flag",
            key: "tilemap_sheet",
            frame: 111
        });

        // Convert coins and flags to static arcade physics bodies
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.flags, Phaser.Physics.Arcade.STATIC_BODY);

        // Create groups for collision detection
        this.coinGroup = this.add.group(this.coins);
        this.flagGroup = this.add.group(this.flags);

        // Set up player avatar
        my.sprite.player = this.physics.add.sprite(30, 345, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        this.physics.add.collider(my.sprite.player, this.hazardLayer, () => {
            this.sound.play('drown');
            this.gameOver = true;
        });

        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            obj2.destroy(); // remove coin on overlap
            this.score += 1;
            this.sound.play('coin', { volume: 0.3 });
        });

        // Handle collision with flags (goal)
        this.physics.add.overlap(my.sprite.player, this.flagGroup, (obj1, obj2) => {
            let timeTaken = ((this.time.now - this.startTime) / 1000).toFixed(2);
            this.scene.start('WinScene', { time: timeTaken, points: this.score });
        });

        // Set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();

        this.rKey = this.input.keyboard.addKey('R');
        this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Debug key listener (assigned to F key)
        this.input.keyboard.on('keydown-F', () => {
            this.physics.world.drawDebug = !this.physics.world.drawDebug;
            this.physics.world.debugGraphic.clear();
        }, this);

        // Movement visual effects
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: 'circle_05.png',
            quantity: 2,
            frequency: 25,
            scale: { start: 0.02, end: 0.05 },
            maxAliveParticles: 15,
            lifespan: { min: 200, max: 300 },
            gravityY: -250,
            alpha: { start: 0.4, end: 0.2 },
        });

        my.vfx.walking.stop();

        // Jump particle emitter setup
        my.vfx.jump = this.add.particles(0, 0, 'kenny-particles', {
            frame: 'dirt_02.png',
            lifespan: 300,
            alpha: { start: .5, end: 0 },
            scale: { start: 0.1, end: 0.01 },
            gravityY: 600,
            quantity: 5
        });

        my.vfx.jump.stop(); // don't emit constantly


        // Camera setup
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1, 0, 41);
        this.cameras.main.setDeadzone(50, 25);
        this.cameras.main.setZoom(this.SCALE);
    }

    update() {
        // Reset scene if R is pressed
        if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.scene.restart();
            this.gameOver = false;
            this.hasShownRestartText = false;
            return;
        }

        const emitParticle = (Math.abs(my.sprite.player.body.velocity.x) > 150) && my.sprite.player.body.blocked.down;

        if (this.gameOver) {
            my.sprite.player.setAlpha(0.5);
            my.sprite.player.body.enable = false;
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setVelocityX(0);

            if (!this.rText) {
                this.add.text(my.sprite.player.x, my.sprite.player.y - 50, "Press 'R' to Restart.", {
                    fontSize: '20px',
                    color: '#ffffff',
                }).setOrigin(0.5);
                this.hasShownRestartText = true;
            }

            my.sprite.player.anims.stop();
            my.vfx.walking.stop();
            return; // Freeze controls and movement
        }

        // Player horizontal movement
        if (cursors.left.isDown || this.aKey.isDown) {
            my.sprite.player.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.resetFlip();
            my.sprite.player.anims.play('walk', true);
        } else if (cursors.right.isDown || this.dKey.isDown) {
            my.sprite.player.setAccelerationX(this.ACCELERATION);
            my.sprite.player.setFlip(true, false);
            my.sprite.player.anims.play('walk', true);

            my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

            if (my.sprite.player.body.blocked.down) {
                my.vfx.walking.start();
            }
        } else {
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            my.sprite.player.anims.play('idle');
            my.vfx.walking.stop();
        }

        // Emit walking particles based on movement direction
        if (emitParticle) {
            const particleSpeed = my.sprite.player.flipX ? -this.PARTICLE_VELOCITY : this.PARTICLE_VELOCITY;
            my.vfx.walking.setParticleSpeed(particleSpeed, 0);

            if (!my.vfx.walking.on) {
                my.vfx.walking.start();
            }
        } else {
            my.vfx.walking.stop();
        }

        // Player jump animation
        if (!my.sprite.player.body.blocked.down) {
            my.sprite.player.anims.play('jump');
        }

        // Player jump logic
        if (Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.jumpsUsed++;
            if (this.jumpsUsed < this.maxJumps) {
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
                this.sound.play('jump', { volume: 0.5, rate: .2 });
                my.vfx.jump.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2);
                my.vfx.jump.explode();
            }
        }

        // Reset jump count on landing
        if (my.sprite.player.body.blocked.down) {
            this.jumpsUsed = 0;
        }

        // Limit maximum horizontal speed
        if (Math.abs(my.sprite.player.body.velocity.x) > this.MAX_X_SPEED) {
            my.sprite.player.body.velocity.x = Phaser.Math.Clamp(
                my.sprite.player.body.velocity.x,
                -this.MAX_X_SPEED,
                this.MAX_X_SPEED
            );
        }
    }
}
