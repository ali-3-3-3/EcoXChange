const EcoXChangeToken = artifacts.require("EcoXChangeToken");
const ERC20 = artifacts.require("ERC20");

contract("EcoXChangeToken", (accounts) => {
  let token;
  const [admin, recipient, anotherAccount] = accounts;

  beforeEach(async () => {
    let erc20 = await ERC20.new({ from: admin });
    token = await EcoXChangeToken.new(erc20.address, { from: admin });
  });

  it("Should mint tokens correctly", async () => {
    let amount = 1000;
    await token.getEXC(recipient, amount, { from: admin });
    let balance = await token.checkEXC(recipient);
    assert.equal(
      balance.toNumber(),
      amount,
      "The minted amount should reflect in the recipient's balance"
    );
  });

  it("Should return the correct balances", async () => {
    let amount = 500;
    await token.getEXC(recipient, amount, { from: admin });
    let balance = await token.checkEXC(recipient);
    assert.equal(
      balance.toNumber(),
      amount,
      "The balance should be correctly queried"
    );
  });

  it("Should allow token transfer", async () => {
    let mintAmount = 1000;
    let transferAmount = 600;
    await token.getEXC(recipient, mintAmount, { from: admin });
    await token.transferEXC(anotherAccount, transferAmount, {
      from: recipient,
    });
    let balance = await token.checkEXC(anotherAccount);
    assert.equal(
      balance.toNumber(),
      transferAmount,
      "The transfer amount should reflect in the recipient's balance"
    );
  });

  it("Should prevent transfers exceeding balance", async () => {
    try {
      await token.transferEXC(anotherAccount, 100, { from: recipient });
      assert.fail("The transaction should have failed");
    } catch (error) {
      assert(
        error.toString().includes("revert"),
        "Should revert due to insufficient balance"
      );
    }
  });

  it("Should burn tokens correctly", async () => {
    let mintAmount = 1000;
    let burnAmount = 500;
    await token.getEXC(recipient, mintAmount, { from: admin });
    await token.destroyEXC(recipient, burnAmount, { from: recipient });
    let remainingBalance = await token.checkEXC(recipient);
    assert.equal(
      remainingBalance.toNumber(),
      mintAmount - burnAmount,
      "The remaining balance should be correct after burning"
    );
  });

  it("Should prevent burning more tokens than available", async () => {
    let mintAmount = 500;
    let burnAmount = 600;
    await token.getEXC(recipient, mintAmount, { from: admin });
    try {
      await token.destroyEXC(recipient, burnAmount, { from: recipient });
      assert.fail("The transaction should have failed");
    } catch (error) {
      assert(
        error.toString().includes("revert"),
        "Should revert due to attempting to burn more tokens than are available"
      );
    }
  });
});
