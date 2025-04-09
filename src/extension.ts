import * as vscode from 'vscode';

interface PetOption {
    emoji: string;
    name: string;
}

const AVAILABLE_PETS: PetOption[] = [
    { emoji: '🐒', name: 'Monkey' },
    { emoji: '🐕', name: 'Dog' },
    { emoji: '🦧', name: 'Orangutan' },
    { emoji: '🐩', name: 'Poodle' },
    { emoji: '🐈', name: 'Cat' },
    { emoji: '🐈‍⬛', name: 'Black Cat' },
    { emoji: '🐅', name: 'Tiger' },
    { emoji: '🐆', name: 'Leopard' },
    { emoji: '🫏', name: 'Donkey' },
    { emoji: '🐄', name: 'Cow' },
    { emoji: '🐖', name: 'Pig' },
    { emoji: '🐁', name: 'Mouse' },
    { emoji: '🐀', name: 'Rat' },
    { emoji: '🐇', name: 'Rabbit' },
    { emoji: '🦔', name: 'Hedgehog' },
    { emoji: '🦨', name: 'Skunk' },
    { emoji: '🦥', name: 'Sloth' },
    { emoji: '🐓', name: 'Rooster' },
    { emoji: '🐢', name: 'Turtle' },
    { emoji: '🐍', name: 'Snake' },
    { emoji: '🦖', name: 'T-Rex' },
	{ emoji: '👨', name: 'Donald Trump' },
];

interface PetData {
    name: string;
    type: string;
    typeName: string;
    satiety: number;
}

// Add after AVAILABLE_PETS array
const PET_PHRASES: Record<string, string[]> = {
    'Monkey': ['Ook ook!', 'Eee eee!', 'Ooh ooh ah ah!'],
    'Dog': ['Woof woof!', 'Arf arf!', 'Ruff!'],
    'Orangutan': ['Oook!', 'Hoo hoo!', 'Grr grr!'],
    'Poodle': ['Yip yip!', 'Arf!', 'Woof!'],
    'Cat': ['Meow!', 'Purrrr...', 'Mrrrow!'],
    'Black Cat': ['Meow!', 'Purrrr...', 'Mrrrow!'],
    'Tiger': ['Roar!', 'Grrr!', 'Rawwr!'],
    'Leopard': ['Rawr!', 'Grrrr!', 'Hiss!'],
    'Donkey': ['Hee-haw!', 'Bray!', 'Honk!'],
    'Cow': ['Moo!', 'Mooo!', 'Moooo!'],
    'Pig': ['Oink oink!', 'Snort!', 'Squeal!'],
    'Mouse': ['Squeak!', 'Pip pip!', 'Eek!'],
    'Rat': ['Squeak!', 'Chirp!', 'Eek!'],
    'Rabbit': ['Thump!', 'Snuffle!', 'Purr!'],
    'Hedgehog': ['Snuffle!', 'Huff!', 'Squeak!'],
    'Skunk': ['Sniff!', 'Purr!', 'Chitter!'],
    'Sloth': ['Eeee!', 'Ahhh...', 'Squeee!'],
    'Rooster': ['Cock-a-doodle-doo!', 'Bawk!', 'Cluck!'],
    'Turtle': ['*munching*', '*slow blink*', 'Nom nom...'],
    'Snake': ['Hiss!', 'Sssss...', 'Hsssss!'],
    'T-Rex': ['ROAR!', 'RAWR!', 'GRRR!'],
	'Donald Trump': ['We\'ll set 99% tariff if you don\'t use Typescript', 'Done. War over. Boom!', 'Why are you coding without a suit?'],
};

class VirtualPet {
	private readonly typingPrice = 0.5;
	private readonly eatingDurationMs = 2_000;
	private readonly typingDebounceMs = 1_000;
	private readonly starvingSpeed = 1;
	private readonly starvingPeriodMs = 5_000;
	private readonly statusBarWidth = 20;
	private readonly starvingNotificationPeriodMs = 30_000;

    private pets: PetData[] = [];
    private activePet: PetData | undefined;
    private statusBarItem: vscode.StatusBarItem;
    private updateInterval: NodeJS.Timeout;
    private typingTimeout: NodeJS.Timeout | undefined;
	private eatingTimeout: NodeJS.Timeout | undefined;
	private starvingInterval: NodeJS.Timeout | undefined;
    private typingBuffer: number = 0;
	private isEating = false;

    private getRandomPhrase() {
        if (!this.activePet) {
            return '';
        }

        const phrases = PET_PHRASES[this.activePet.typeName] || ['...'];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    constructor(private context: vscode.ExtensionContext) {
        this.pets = context.globalState.get('pets', []);
        this.activePet = context.globalState.get('activePet');
        
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.statusBarItem.show();
        
        this.updateInterval = setInterval(() => this.update(), this.starvingPeriodMs);
        this.updateDisplay();
        
        vscode.workspace.onDidChangeTextDocument(this.handleTyping.bind(this));
    }

    private handleTyping(event: vscode.TextDocumentChangeEvent) {
		if (!event.contentChanges.length || event.contentChanges[0].text === '') {
			return;
		}

        if (!this.activePet) {
			return;
		}

        // Count characters typed
        const charCount = event.contentChanges.reduce((sum, change) => 
            sum + change.text.length, 0);
        
        this.typingBuffer += charCount;

        if (this.typingTimeout) {
			return;
        }

        this.typingTimeout = setTimeout(async () => {
			if (!this.activePet) {
				return;
			}

			const feedAmount = Math.floor(this.typingBuffer) * this.typingPrice;

			this.feed(feedAmount);
			
            this.typingBuffer = 0;
			this.typingTimeout = undefined;
        }, this.typingDebounceMs);
    }

    public async adoptPet() {
        const selectedType = await vscode.window.showQuickPick(
            AVAILABLE_PETS.map(pet => `${pet.emoji} ${pet.name}`),
            { placeHolder: 'Choose pet type' }
        );

		if (!selectedType) {
			return;
		}
        
		const petType = AVAILABLE_PETS.find(p => `${p.emoji} ${p.name}` === selectedType)!;
		const name = await vscode.window.showInputBox({
			placeHolder: 'Give your pet a name',
			prompt: `Name your new ${petType.name}`
		});

		if (!name) {
			return;
		}
		
		const newPet: PetData = {
			name,
			type: petType.emoji,
			typeName: petType.name,
			satiety: 100
		};
		
		this.pets.push(newPet);
		this.activePet = newPet;
		await this.savePets();
		this.updateDisplay();
		vscode.window.showInformationMessage(`Take good care of ${petType.emoji} ${name} now!`);
    }

    // Add this new method
    private getSatietyInfo(satiety: number): { color: string; status: string } {
        if (satiety > 80) {
            return { color: '#3EC73E', status: 'full' };
        } else if (satiety > 60) {
            return { color: '#98C379', status: 'ok' };
        } else if (satiety > 40) {
            return { color: '#E5C07B', status: 'peckish' };
        } else if (satiety > 20) {
            return { color: '#E06C75', status: 'hungry' };
        } else {
            return { color: '#BE5046', status: 'starving' };
        }
    }

    private updateDisplay() {
		if (!this.activePet) {
			this.statusBarItem.text = `No active pet`;
            this.statusBarItem.color = undefined;
			this.statusBarItem.command = 'code4food.adoptPet';

			return;
		}

		const { color, status } = this.getSatietyInfo(this.activePet.satiety);
		this.statusBarItem.color = color;
		this.statusBarItem.command = 'code4food.speak';

		if (this.isEating) {
			this.setStatus(`🍽️ Omnomnom`);

			return;
		}

		this.statusBarItem.tooltip = `${Math.floor(this.activePet.satiety)}%`;
		this.setStatus(status);
    }

	private padStatusBar(status: string): string {
		const omnomnomEmojiModifier = this.isEating ? 1 : 0;

		const padWidth = this.statusBarWidth + (this.activePet?.name.length ?? 0) + omnomnomEmojiModifier;

        return status.padEnd(padWidth);
    }

	private setStatus(status: string) {
        if (!this.activePet) {
            return;
        }

        this.statusBarItem.text = this.padStatusBar(`${this.activePet.type} ${this.activePet.name} (${status})`);
    }

    public async switchPet() {
        if (this.pets.length === 0) {
            vscode.window.showInformationMessage('You have no pets yet! Try adopting one first.');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            this.pets.map(pet => {
                const { status } = this.getSatietyInfo(pet.satiety);
                return `${pet.type} ${pet.name} (${status})`;
            }),
            { placeHolder: 'Choose pet to activate' }
        );

        if (!selected) {
            return;
        }

        const petName = selected.split(' ')[1];
        this.activePet = this.pets.find(p => p.name === petName);
        await this.context.globalState.update('activePet', this.activePet);
        this.updateDisplay();
        vscode.window.showInformationMessage(`Switched to ${this.activePet?.type} ${this.activePet?.name}`);
    }

	private checkIsStarving() {
		if (!this.activePet) {
			return;
		}

		if (this.activePet.satiety > 0) {
			if (this.starvingInterval) {
				clearInterval(this.starvingInterval);
            	this.starvingInterval = undefined;
			}

			return;
		}

		if (this.starvingInterval) {
			return;
		}

		this.starvingInterval = setInterval(() => {
			if (!this.activePet) {
				return;
			}

			if (this.activePet.satiety > 0) {
				return;
			}

			vscode.window.showErrorMessage(`${this.activePet.type} ${this.activePet.name} doesn't feel good, please start coding to feed them! 🍽️`);
		}, this.starvingNotificationPeriodMs);
	}

    private async update() {
		if (!this.activePet) {
			return;
		}

		if (this.isEating) {
			return;
		}

		const previousSatiety = this.activePet.satiety;
		this.activePet.satiety = Math.max(0, this.activePet.satiety - this.starvingSpeed);
		
		if (previousSatiety > 20 && this.activePet.satiety <= 20) {
			vscode.window.showWarningMessage(`${this.activePet.type} ${this.activePet.name} is starving! Please feed them!`);
		} else if (previousSatiety > 40 && this.activePet.satiety <= 40) {
			vscode.window.showInformationMessage(`${this.activePet.type} ${this.activePet.name} is getting hungry`);
		}

		this.checkIsStarving();

		await this.savePets();
		this.updateDisplay();
    }

    public async feed(amount: number) {
		if (!this.activePet) {
			return;
		}

		if (this.isEating) {
			return;
		}

		this.isEating = true;
		this.updateDisplay();

		if (this.eatingTimeout) {
            clearTimeout(this.eatingTimeout);
        }

        this.eatingTimeout = setTimeout(async () => {
			this.isEating = false;

			if (!this.activePet) {
				return;
			}

			this.activePet.satiety = Math.min(100, this.activePet.satiety + amount);
			await this.savePets();
			this.updateDisplay();
        }, this.eatingDurationMs);
    }

    public speak() {
        if (!this.activePet) {
            return;
        }

        void vscode.window.showInformationMessage(
            `${this.activePet.type} ${this.activePet.name}: ${this.getRandomPhrase()}`
        );
    }

    private async savePets() {
        await this.context.globalState.update('pets', this.pets);
        await this.context.globalState.update('activePet', this.activePet);
    }

    public dispose() {
        clearInterval(this.updateInterval);
        this.statusBarItem.dispose();
    }
}

export function activate(context: vscode.ExtensionContext) {
    const pet = new VirtualPet(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('code4food.adoptPet', () => pet.adoptPet()),
        vscode.commands.registerCommand('code4food.switchPet', () => pet.switchPet()),
        vscode.commands.registerCommand('code4food.speak', () => pet.speak())
    );
}

export function deactivate() {}
