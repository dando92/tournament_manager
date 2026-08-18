import { Standing } from "@persistence/entities";

export class IScoringSystem {
    constructor() {
        if (this.constructor === IScoringSystem) {
            throw new Error("Cannot instantiate an abstract class.");
        }
    }

    getName() : string {
        throw new Error("Method 'Name' should be implemented.");
    }

    getDescription() : string {
        throw new Error("Method 'Description' should be implemented.");
    }

    recalc(standings: Standing[]) {
        throw new Error("Method 'recalc' should be implemented.");
    }
}


